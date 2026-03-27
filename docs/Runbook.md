# Runbook（从零到第一通 SIP 测试电话）

本文档用于你当前这个项目的 V1 验收：`Asterisk + Node.js API + SQLite`。

## 0. 先回答你的 3 个问题

### Q1: API Key 该怎么填写？
API Key 需要填两处，但值必须一致：
1. 服务器端：`/home/ubuntu/fyp/PrivacyCalling/deploy/env/privacy-calling.env` 的 `API_KEY=...`
2. 客户端调用 API 时：HTTP Header `x-api-key: ...`

也就是说，API Key 是服务端定义的密钥，客户端只是携带它。

### Q2: 是否只需要在客户端填写用户，不需要服务器端填写？
不是。SIP 用户必须先在服务器定义，再在客户端登录。

必须同时满足：
1. 服务器 Asterisk 里有 SIP endpoint（例如 `alice`、`bob`，在 `deploy/asterisk/pjsip.conf`）
2. 服务器 SQLite 里有业务用户映射（`users` 表，`caller_endpoint` 对应 endpoint）
3. 客户端软电话用对应账号密码注册到服务器

如果只在客户端填账号，而服务器没这个 endpoint 或数据库没这个用户映射，呼叫会失败。

### Q3: 我该怎样发起测试通话？
你可以走两条路径：
1. 客户端直拨测试（见第 5 节）：在 MicroSIP/Sipnetic 里直接拨 `bob` 或 `+8613900000002`
2. 隐私模式测试（见第 6 节）：调用 `POST /v1/calls`，由系统回拨并做虚拟号掩码

区别：
1. 客户端直拨：不需要 API，直接在软电话拨号，同时自动做匿名主叫（虚拟号）
2. API 回拨：由服务端先回拨 Caller，再呼叫 Callee 并桥接，也会做匿名主叫

---

## 1. 前置条件检查

在服务器执行：

```bash
cd /home/ubuntu/fyp/PrivacyCalling

sudo systemctl status asterisk --no-pager
sudo systemctl status privacy-calling-api --no-pager

sudo asterisk -rx 'core show version'
sudo asterisk -rx 'pjsip show endpoints'
```

预期：
1. 两个服务都是 `active (running)`
2. `pjsip show endpoints` 能看到 `alice`、`bob`、`charlie`

### 1.1 服务启停与开机自启（不测试时可关闭）

本项目“整套服务”包含两个 systemd 单元：
1. `asterisk`（SIP/RTP/桥接）
2. `privacy-calling-api`（Node.js 控制面 API）

临时关闭（不改自启策略）：

```bash
sudo systemctl stop privacy-calling-api
sudo systemctl stop asterisk
```

恢复启动（建议先 SIP 核心再 API）：

```bash
sudo systemctl start asterisk
sudo systemctl start privacy-calling-api
```

一键重启：

```bash
sudo systemctl restart asterisk
sudo systemctl restart privacy-calling-api
```

查看运行状态：

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
```

如果你希望“服务器重启后也不要自动启动”：

```bash
sudo systemctl disable --now privacy-calling-api asterisk
```

恢复开机自启并立即启动：

```bash
sudo systemctl enable --now asterisk privacy-calling-api
```

### 1.2 Material You 运维面板（/dashboard）

访问地址：
1. 本机访问：`http://127.0.0.1:8080/dashboard`
2. 远程访问：`http://<服务器公网IP>:8080/dashboard`

首次打开需要在页面顶部填入 API Key（与你 `deploy/env/privacy-calling.env` 的 `API_KEY` 一致）。

面板能力：
1. 查看服务状态（`asterisk`、`privacy-calling-api`）
2. 查看 API/DB/AMI 健康与最近通话
3. 一键 `start/stop/restart` 服务
4. 查看告警中心（warning/error 聚合）
5. 查看服务器负载曲线（2 秒刷新，默认 10 分钟窗口）
6. 查看分级日志（`debug/info/warning/error` 高亮、关键词过滤、JSON 导出）
7. 查看操作审计时间线（落库到 SQLite）

说明：
1. 最近通话现在同时包含 `POST /v1/calls` 回拨呼叫与客户端直拨呼叫
2. 若你刚升级代码，请先执行一次 `sudo ./scripts/deploy-asterisk-config.sh` 和 `sudo systemctl restart privacy-calling-api`

如果你发现“按钮可见但点击提示权限不足”，说明 Node 进程（`ubuntu` 用户）没有 sudo 免密执行 `systemctl` 的权限。执行一次：

```bash
SYSTEMCTL_BIN="$(command -v systemctl)"
echo "ubuntu ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} start asterisk, ${SYSTEMCTL_BIN} stop asterisk, ${SYSTEMCTL_BIN} restart asterisk, ${SYSTEMCTL_BIN} start privacy-calling-api, ${SYSTEMCTL_BIN} stop privacy-calling-api, ${SYSTEMCTL_BIN} restart privacy-calling-api" | sudo tee /etc/sudoers.d/privacy-calling-ops
sudo chmod 440 /etc/sudoers.d/privacy-calling-ops
sudo systemctl restart privacy-calling-api
```

日志排查接口示例（需 API Key）：

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/logs?services=privacy-calling-api,asterisk,asterisk-full&levels=warning,error&since_sec=600&limit=100'
```

审计排查接口示例（需 API Key）：

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/audit-events?limit=30'
```

---

## 2. 一次性初始化（首次部署或重置后）

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm install
npm run db:init
npm run db:seed
```

检查数据库内容：

```bash
sqlite3 data/privacy.db "select id,display_name,real_e164,caller_endpoint,enabled from users;"
sqlite3 data/privacy.db "select id,e164,enabled from virtual_numbers;"
```

默认种子（你现在可直接用）：
1. Caller 用户 ID：`caller-alice`，端点 `alice`，真实号 `+8613900000001`
2. Callee 用户：`callee-bob`，端点 `bob`，真实号 `+8613900000002`
3. Caller 用户 ID：`caller-charlie`，端点 `charlie`，真实号 `+8613900000003`
4. 虚拟号池：`+8613800011111/1112/1113`

---

## 3. API Key 配置与生效

### 3.1 修改服务器 API Key
编辑：`/home/ubuntu/fyp/PrivacyCalling/deploy/env/privacy-calling.env`

例如：

```env
API_KEY=my-strong-api-key-001
```

如果你暂时还没改，默认值就是：`change-me-api-key`。

### 3.2 重启 API 服务

```bash
sudo systemctl restart privacy-calling-api
sudo systemctl status privacy-calling-api --no-pager
```

### 3.3 用同一个值调用 API

调用时 Header 必须是：

```bash
-H 'x-api-key: my-strong-api-key-001'
```

如果不一致，会返回 401。

---

## 4. 软电话登录（MicroSIP / Sipnetic）

### 4.1 先启用“客户端直拨隐私路由”（只需做一次）
为了让客户端直接拨号时自动做隐私保护，先在服务器执行：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo asterisk -rx 'dialplan show caller_in'
sudo asterisk -rx 'dialplan show select_virtual'
```

如果能看到 `caller_in` 和 `select_virtual` context，说明直拨隐私路由已生效。

### 4.2 MicroSIP 登录参数（Windows）

先记一个变量：
1. `SERVER_IP` = 你的服务器公网 IP（示例：`1.2.3.4`）

Alice 账号逐字段填写（按你看到的字段名）：
1. 账户名称: `Alice`
2. SIP服务器: `SERVER_IP:5160`（示例 `1.2.3.4:5160`）
3. SIP代理: `SERVER_IP:5160`
4. 用户名: `alice`
5. 域名: `SERVER_IP`（只填 IP，不带端口）
6. 登录名: `alice`
7. 密码: `alice-strong-password`

Bob 账号逐字段填写：
1. 账户名称: `Bob`
2. SIP服务器: `SERVER_IP:5160`
3. SIP代理: `SERVER_IP:5160`
4. 用户名: `bob`
5. 域名: `SERVER_IP`
6. 登录名: `bob`
7. 密码: `bob-strong-password`

Charlie 账号逐字段填写：
1. 账户名称: `Charlie`
2. SIP服务器: `SERVER_IP:5160`
3. SIP代理: `SERVER_IP:5160`
4. 用户名: `charlie`
5. 域名: `SERVER_IP`
6. 登录名: `charlie`
7. 密码: `charlie-strong-password`

补充建议：
1. Transport 选择 `UDP`
2. 不启用 TLS/SRTP（当前 V1 未开启）
3. 不要在 `SIP服务器` / `SIP代理` 填 `sip:` 前缀
4. 域名不要写成 `SERVER_IP:5160`（域名只填 IP）

### 4.3 Sipnetic 登录参数（Android）

Alice 账号逐字段填写（按你看到的字段名）：
1. Display name: `Alice`
2. user name: `alice`
3. authentication user: `alice`
4. password: `alice-strong-password`
5. domain: `SERVER_IP`（只填 IP，不带端口）
6. proxy server address: `SERVER_IP:5160`

Bob 账号逐字段填写：
1. Display name: `Bob`
2. user name: `bob`
3. authentication user: `bob`
4. password: `bob-strong-password`
5. domain: `SERVER_IP`
6. proxy server address: `SERVER_IP:5160`

Charlie 账号逐字段填写：
1. Display name: `Charlie`
2. user name: `charlie`
3. authentication user: `charlie`
4. password: `charlie-strong-password`
5. domain: `SERVER_IP`
6. proxy server address: `SERVER_IP:5160`

补充建议：
1. Transport 选择 `UDP`
2. 如果有“Outbound proxy mode”，选择 `Always`
3. 不要给 `domain` 填端口

### 4.4 注册成功确认

```bash
sudo asterisk -rx 'pjsip show contacts'
```

预期：`alice`、`bob`、`charlie` 都是 `Avail` / `Reachable`（不是 `Unavailable`）。

如果 MicroSIP 仍提示“没有找到用户/无法注册”，立刻执行：

```bash
sudo asterisk -rx 'pjsip show endpoints'
sudo asterisk -rx 'pjsip show contacts'
sudo asterisk -rvvv
```

然后在 Asterisk CLI 里执行：

```text
pjsip set logger on
```

再从客户端点一次注册，观察是否出现 `REGISTER` 请求和 `401/403/404` 响应码。

### 4.5 针对你这个报错的特定说明（AOR '' not found）

如果你看到类似日志：

```text
find_registrar_aor: AOR '' not found for endpoint 'alice' / 'bob'
```

含义：客户端发来的 REGISTER 没带正确的用户 AOR（常见是字段填法不对）。

本项目已做服务端兼容修复（AOR 名与用户名同名：`alice`、`bob`、`charlie`），你还需要确保客户端字段严格如下：
1. `用户名/user name` = `alice` 或 `bob` 或 `charlie`
2. `登录名/authentication user` = `alice` 或 `bob` 或 `charlie`
3. `域名/domain` = `SERVER_IP`（不带端口）
4. `SIP服务器/proxy` = `SERVER_IP:5160`

并且不要填：
1. 空用户名
2. `domain` 写成 `SERVER_IP:5160`
3. `SIP服务器` 填 `sip:SERVER_IP:5160`

---

## 5. 通过客户端直接发起测试通话（不在服务器敲命令）

在 Alice 客户端直接拨号以下任一目标：
1. `bob`
2. `sip:bob@<你的服务器公网IP>:5160`
3. `+8613900000002`

然后 Bob 客户端接听即可。
预期 Bob 看到主叫号：`+8613800011111`（虚拟号）。

反向测试时，Bob 可拨：
1. `alice`
2. `sip:alice@<你的服务器公网IP>:5160`
3. `+8613900000001`
预期 Alice 看到主叫号：`+8613800011112`（虚拟号）。

新增用户测试（Charlie）：
1. Alice 可拨 `charlie` / `sip:charlie@<你的服务器公网IP>:5160` / `+8613900000003`
2. Charlie 可拨 `alice` / `bob` 或其 E.164

注意：现在“客户端直拨”默认也做隐私保护。Bob 应看到虚拟号（例如 `+8613800011111`），而不是 Alice 真实身份。

### 5.1 客户端单端语音自检（Echo Test）

如果你要先验证“客户端到 Asterisk 的语音链路是否通”，直接在任一已注册客户端拨：
1. `*900`（首选）
2. `900`（如果软电话把 `*` 吃掉）

预期行为：
1. 先听到提示音（`demo-echotest`）
2. 之后你说话会被系统回放（有轻微延迟）

判定标准：
1. 能听到提示音，但听不到自己回声：通常是“客户端 -> Asterisk”上行 RTP 没到
2. 连提示音都听不到：通常是“Asterisk -> 客户端”下行 RTP 没到
3. 提示音和回声都正常：该客户端与服务器语音链路基本正常，再测双端互拨

---

## 6. 隐私模式测试（API 触发回拨）

### 6.1 触发隐私呼叫

```bash
curl -sS -X POST 'http://127.0.0.1:8080/v1/calls' \
  -H 'x-api-key: my-strong-api-key-001' \
  -H 'content-type: application/json' \
  -d '{
    "caller_user_id": "caller-alice",
    "callee_e164": "+8613900000002",
    "timeout_sec": 20
  }'
```

说明：
1. 在服务器本机执行用 `127.0.0.1`
2. 在你自己电脑执行请改成 `http://<服务器公网IP>:8080/...`（并确保安全组/防火墙放行 8080）

会返回：

```json
{
  "call_id": "...",
  "selected_virtual_id": "+8613800011111",
  "status": "originating"
}
```

### 6.2 人工接听顺序（非常重要）
1. 先接听 Alice（系统先回拨 Alice）
2. 然后 Bob 会响铃
3. Bob 接听后，双方通话建立
4. Bob 看到的是虚拟号，不是 Alice 真实号

### 6.3 查询状态

```bash
curl -sS -H 'x-api-key: my-strong-api-key-001' \
  'http://127.0.0.1:8080/v1/calls/<替换成call_id>'
```

可重复执行观察状态。

---

## 7. 常见状态解释

`GET /v1/calls/{id}` 常见字段：
1. `status=originating/ringing/answered/bridged/completed/failed`
2. `a_leg_status`：Caller 腿状态
3. `b_leg_status`：Callee 腿状态
4. `bridge_status`：`pending/bridged/released`
5. `failure_reason`：失败原因（Asterisk 原因码或状态）

快速判断：
1. `a_leg_status=failed`：通常 Caller 未注册/未接听/账号错误
2. `b_leg_status=failed`：通常 Callee 未注册/号码映射不到本地用户/Trunk 不可用
3. `status=failed` 且 `failure_reason=trunk_not_configured`：你传的是外部号码，但未启用可用 Trunk

---

## 8. 你当前最容易踩的坑（按概率排序）

1. API Key 不一致
- 现象：所有 `/v1/*` 返回 401
- 修复：确认 env 里的 `API_KEY` 与 curl Header 完全一致

2. 软电话未成功注册
- 现象：呼叫发起成功但很快 failed
- 修复：`sudo asterisk -rx 'pjsip show contacts'` 检查在线状态

3. `caller_user_id` 写错
- 现象：`caller_not_found`
- 修复：使用 `caller-alice`（默认种子）或在 `users` 表新增后再调用

4. `callee_e164` 与本地用户不匹配
- 现象：`trunk_not_configured` 或 B-leg failed
- 修复：SIP↔SIP 测试时用 `+8613900000002`（默认 Bob 真实号）

---

## 9. 必要排障命令

### API 服务日志
```bash
sudo journalctl -u privacy-calling-api -f
```

### Asterisk 落盘日志（推荐发这个文件，不用手抄终端）
```bash
sudo ls -lh /var/log/asterisk/
sudo tail -n 200 /var/log/asterisk/messages
sudo tail -n 200 /var/log/asterisk/full
```

说明：
1. `messages` 只有 notice/warning/error
2. `full` 含 verbose/debug（含 SIP/RTP 详细日志）

### Asterisk CLI
```bash
sudo asterisk -rvvv
```

进入 CLI 后可执行：
```text
pjsip show endpoints
pjsip show contacts
core set verbose 5
core set debug 3
pjsip set logger on
rtp set debug on
```

如果你想把一次测试完整保存成文件（便于发我）：
```bash
sudo asterisk -rx 'core set verbose 5'
sudo asterisk -rx 'core set debug 3'
sudo asterisk -rx 'pjsip set logger on'
sudo asterisk -rx 'rtp set debug on'
sudo timeout 120 tail -f /var/log/asterisk/full | tee /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log
```

也可以用一键脚本：
```bash
cd /home/ubuntu/fyp/PrivacyCalling
./scripts/capture-audio-debug.sh /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log 120
```

### 数据库看最新通话
```bash
sqlite3 data/privacy.db "select id,status,a.created_at,failure_reason from calls a order by a.created_at desc limit 10;"
```

---

## 10. 无声问题专项排查（重点）

如果“能接通但没声音”，按这个顺序检查：

1. 检查 SIP/SDP 是否发布公网地址
```bash
sudo asterisk -rx 'pjsip show transport transport-udp-privacy'
```
预期：
1. `external_signaling_address = 118.25.104.104`
2. `external_media_address = 118.25.104.104`

2. 通话时看 200 OK SDP 的 `c=` 地址
在 `pjsip set logger on` 输出里，找到 200 OK 的 SDP：
1. 正确：`c=IN IP4 118.25.104.104`
2. 错误：`c=IN IP4 10.x.x.x / 192.168.x.x / 172.16-31.x.x`

3. 检查云安全组（非常关键）
必须放行 UDP：
1. `5160`
2. `20000-20199`

4. 检查是否收到了 ACK（针对 200 OK）
如果 Asterisk 对同一个 INVITE 连续重发多个 `200 OK`，通常是客户端 ACK 没到服务端（多半是 Contact/路由/NAT 问题）。

5. 检查 RTP 是否双向
在 Asterisk CLI 执行 `rtp set debug on`，通话时应同时看到：
1. `Sent RTP packet to ...`
2. `Got RTP packet from ...`

如果只有 Sent 没有 Got，通常是客户端到服务端 RTP 被防火墙/运营商 NAT 拦截。

---

## 11. 如果你要新增一个测试用户（示例：david）

你要做 4 件事，缺一不可：

1. 在 `deploy/asterisk/pjsip.conf` 增加 `david` 的三段配置（`type=endpoint/auth/aor`，section 名都用 `david`）。
2. 在 `deploy/asterisk/extensions.conf` 的 `[resolve_target]` 增加 david 的目标映射（endpoint 与 E.164）。
3. 在 `deploy/asterisk/extensions.conf` 的 `[select_virtual]` 增加 david 被叫时使用的虚拟号规则。
4. 在 SQLite 增加 users 记录（`caller_endpoint` 必须等于 endpoint 名）：
```bash
sqlite3 data/privacy.db "
insert into users(id,display_name,real_e164,caller_endpoint,enabled,created_at,updated_at)
values('caller-david','David Caller','+8613900000004','david',1,datetime('now'),datetime('now'));
"
```

配置改完后执行：
```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo asterisk -rx 'dialplan show resolve_target'
sudo asterisk -rx 'dialplan show select_virtual'
```

然后客户端才能用 `david` 登录，API 才能用 `caller_user_id=caller-david`，并且客户端直拨也能保持隐私号码显示。

---

## 12. SIP↔PSTN（后续）

目前默认是 SIP↔SIP 验收路径。要开 PSTN：
1. 配置 `deploy/asterisk/pjsip.conf` 的 `carrier_out` 真实 Trunk 参数
2. 在 `trunks` 表把默认 trunk 设为 `enabled=1`
3. 重启 Asterisk 与 API

```bash
sudo systemctl restart asterisk
sudo systemctl restart privacy-calling-api
```
