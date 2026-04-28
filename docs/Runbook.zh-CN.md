# Privacy Calling 运维 Runbook

英文版：`docs/Runbook.md`

本文档是 Privacy Calling 非 Docker 部署在项目验收环境下的标准运维操作手册。内容按场景组织，便于操作人员根据当前情况快速选择合适的处理流程。

## 1. 适用范围

本部署包含以下组件：

- `asterisk`：负责 SIP 信令、RTP 媒体处理与通话桥接
- `privacy-calling-api`：负责 Node.js 控制面 API 与运维面板
- `SQLite`：本地数据存储，路径为 `data/privacy.db`

本 Runbook 覆盖的核心能力包括：

- 客户端直拨并自动做隐私主叫掩码
- 通过 `POST /v1/calls` 发起 API 回拨式隐私通话
- SIP MESSAGE 隐私转发
- `/dashboard` 运维面板
- 可选的 AI 诊断
- 可选的区块链演示鉴权

## 2. 标准服务、文件与演示数据

### 2.1 systemd 服务

- `asterisk`
- `privacy-calling-api`

### 2.2 主要文件

- 环境变量文件：`deploy/env/privacy-calling.env`
- 环境变量模板：`deploy/env/privacy-calling.env.example`
- Asterisk SIP 配置：`deploy/asterisk/pjsip.conf`
- Asterisk 拨号计划：`deploy/asterisk/extensions.conf`
- Asterisk RTP 配置：`deploy/asterisk/rtp.conf`
- 数据库：`data/privacy.db`

### 2.3 执行 `npm run db:seed` 后的默认演示身份

- API 主叫用户：
  - `caller-alice` -> endpoint `alice` -> 真实号码 `+8613900000001`
  - `caller-charlie` -> endpoint `charlie` -> 真实号码 `+8613900000003`
- 演示被叫用户：
  - `callee-bob` -> endpoint `bob` -> 真实号码 `+8613900000002`
- 演示虚拟号池：
  - `+8613800011111`
  - `+8613800011112`
  - `+8613800011113`

请注意三个概念的区别：

- API 调用时使用的是 `caller_user_id`，例如 `caller-alice`
- SIP 客户端注册时使用的是 endpoint 账号，例如 `alice` 或 `bob`
- 服务端 API Key 定义在 `deploy/env/privacy-calling.env`
- API 客户端必须在 `x-api-key` 请求头中携带完全相同的值

## 3. 场景 1：首次部署或整套重置

当你在新服务器上首次搭建环境、重建测试环境，或需要从零重置项目时，使用本流程。

### 3.1 操作步骤

1. 安装系统依赖：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/install-system.sh
```

2. 安装 Node.js 依赖：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm install
```

3. 如果环境变量文件不存在，则先创建：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
cp deploy/env/privacy-calling.env.example deploy/env/privacy-calling.env
```

4. 编辑 `deploy/env/privacy-calling.env`，至少确认以下字段：

- `API_KEY`
- `ASTERISK_AMI_SECRET`
- 如果不想使用默认鉴权行为，则确认 `AUTH_MODE`
- 如果要启用 AI 诊断，则配置 `LLM_*`

5. 编辑 `deploy/asterisk/pjsip.conf`，至少确认以下内容：

- `external_signaling_address` 与服务器公网 IP 一致
- `external_media_address` 与服务器公网 IP 一致
- `alice`、`bob`、`charlie` 的账号密码
- 如果计划测试 PSTN，则补全 trunk 占位参数

说明：仓库当前的 `deploy/asterisk/pjsip.conf` 中已经写入了一个具体公网 IP。如果你的服务器 IP 不同，必须替换。

6. 初始化并写入演示数据库：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run db:init
npm run db:seed
```

7. 下发 Asterisk 配置并同步 AstDB：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

8. 安装并启动 API 的 systemd 服务：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/install-systemd-service.sh
```

### 3.2 验证方法

执行：

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
curl -sS http://127.0.0.1:8080/health
sudo asterisk -rx 'pjsip show endpoints'
```

预期结果：

- 两个服务都为 `active (running)`
- `/health` 返回 `status: ok`
- endpoint 列表中可以看到 `alice`、`bob`、`charlie`

## 4. 场景 2：服务启停、重启与开机自启控制

当你需要日常启停服务、执行维护重启，或控制系统开机自启行为时，使用本流程。

### 4.1 暂停服务但不修改自启策略

```bash
sudo systemctl stop privacy-calling-api
sudo systemctl stop asterisk
```

### 4.2 启动服务

建议先启动 Asterisk，再启动 API：

```bash
sudo systemctl start asterisk
sudo systemctl start privacy-calling-api
```

### 4.3 重启服务

```bash
sudo systemctl restart asterisk
sudo systemctl restart privacy-calling-api
```

### 4.4 查看当前状态

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
```

### 4.5 关闭开机自启

```bash
sudo systemctl disable --now privacy-calling-api asterisk
```

### 4.6 恢复开机自启并立即启动

```bash
sudo systemctl enable --now asterisk privacy-calling-api
```

## 5. 场景 3：测试前的基线健康检查

在验收演示前、客户端测试前，或重启之后，建议先执行本流程。

### 5.1 操作步骤

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo systemctl status asterisk privacy-calling-api --no-pager
sudo asterisk -rx 'core show version'
sudo asterisk -rx 'pjsip show endpoints'
sudo asterisk -rx 'pjsip show contacts'
curl -sS http://127.0.0.1:8080/health
```

### 5.2 预期结果

- 两个 systemd 服务都在运行
- `pjsip show endpoints` 能看到预期 endpoint
- 已注册客户端可以在 `pjsip show contacts` 中看到
- `/health` 显示数据库和 AMI 都正常

### 5.3 如果健康检查失败

- 如果 `privacy-calling-api` 异常，查看 `journalctl -u privacy-calling-api`
- 如果 Asterisk 异常，查看 `systemctl status asterisk` 与 Asterisk 日志
- 如果 AMI 不健康，检查 `deploy/env/privacy-calling.env` 中的 `ASTERISK_AMI_*`
- 如果没有 contacts，说明 SIP 客户端尚未成功注册

## 6. 场景 4：安全地下发配置变更

当你修改了环境变量、Asterisk 配置，或数据库中的用户与映射数据时，使用本流程。

### 6.1 API 环境变量变更

常见包括：

- `API_KEY`
- `AUTH_*`
- `LLM_*`
- `ASTERISK_AMI_*`

执行：

```bash
sudo systemctl restart privacy-calling-api
sudo systemctl status privacy-calling-api --no-pager
```

### 6.2 Asterisk SIP 或 dialplan 变更

常见包括：

- `deploy/asterisk/pjsip.conf`
- `deploy/asterisk/extensions.conf`
- `deploy/asterisk/rtp.conf`
- `deploy/asterisk/logger.conf`

执行：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
```

### 6.3 SQLite 用户、虚拟号或映射变更

如果你修改了数据库中需要被 dialplan 读取的数据，请同步 AstDB：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/sync-asterisk-astdb.sh
```

### 6.4 建议的变更后验证

```bash
sudo asterisk -rx 'dialplan show caller_in'
sudo asterisk -rx 'dialplan show resolve_target'
sudo asterisk -rx 'dialplan show select_virtual'
sudo asterisk -rx 'pjsip show endpoints'
curl -sS http://127.0.0.1:8080/health
```

## 7. 场景 5：配置或轮换 API Key

当你首次设置 API Key，或出于安全原因需要更换 Key 时，使用本流程。

### 7.1 修改服务端 API Key

编辑 `deploy/env/privacy-calling.env`：

```env
API_KEY=my-strong-api-key-001
```

### 7.2 重启 API 服务

```bash
sudo systemctl restart privacy-calling-api
sudo systemctl status privacy-calling-api --no-pager
```

### 7.3 客户端请求必须使用相同的值

所有受保护接口请求都必须携带：

```bash
-H 'x-api-key: my-strong-api-key-001'
```

### 7.4 典型失败现象

如果 Header 中的值与服务端不一致，API 会返回 `401`。

## 8. 场景 6：使用运维面板

当你想通过浏览器快速查看系统状态，或执行简单的服务控制时，使用本流程。

### 8.1 访问地址

- 本机：`http://127.0.0.1:8080/dashboard`
- 远程：`http://<服务器公网IP>:8080/dashboard`

### 8.2 面板能力

- 查看 `asterisk` 与 `privacy-calling-api` 服务状态
- 查看 API、数据库、AMI 健康状态
- 查看最近通话
- 查看告警中心
- 查看服务器负载曲线
- 查看分级日志
- 查看审计事件时间线
- 使用可选的 AI 诊断

### 8.3 登录方式

输入与 `deploy/env/privacy-calling.env` 中相同的 API Key。

### 8.4 如果服务控制按钮提示权限不足

需要给 `ubuntu` 用户授予特定 `systemctl` 的免密 sudo 权限：

```bash
SYSTEMCTL_BIN="$(command -v systemctl)"
echo "ubuntu ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} start asterisk, ${SYSTEMCTL_BIN} stop asterisk, ${SYSTEMCTL_BIN} restart asterisk, ${SYSTEMCTL_BIN} start privacy-calling-api, ${SYSTEMCTL_BIN} stop privacy-calling-api, ${SYSTEMCTL_BIN} restart privacy-calling-api" | sudo tee /etc/sudoers.d/privacy-calling-ops
sudo chmod 440 /etc/sudoers.d/privacy-calling-ops
sudo systemctl restart privacy-calling-api
```

### 8.5 常用运维 API

日志查询：

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/logs?services=privacy-calling-api,asterisk,asterisk-full&levels=warning,error&since_sec=600&limit=100'
```

审计查询：

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/audit-events?limit=30'
```

## 9. 场景 7：配置与使用 AI 诊断

当你希望通过大模型自动汇总服务状态、告警、日志和审计信息时，使用本流程。

### 9.1 配置方法

编辑 `deploy/env/privacy-calling.env`：

```env
LLM_ENABLED=true
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
LLM_TIMEOUT_MS=30000
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=1600
LLM_DIAGNOSTIC_LOG_LIMIT=120
LLM_DIAGNOSTIC_LOG_SINCE_SEC=900
```

说明：

- 服务端会向 `LLM_BASE_URL` 发送 OpenAI-compatible 的 `POST /chat/completions` 请求
- 你也可以把 `LLM_BASE_URL` 指向其他兼容网关
- 仓库当前的部署环境示例文件中使用了 DeepSeek 风格的示例值，只要上游兼容即可

### 9.2 应用配置

```bash
sudo systemctl restart privacy-calling-api
```

### 9.3 在页面中使用

1. 打开 `/dashboard`
2. 使用 API Key 登录，或在启用时使用 demo login
3. 点击 `AI Diagnostics`
4. 查看总结、诊断发现与建议命令

### 9.4 通过 API 调用

```bash
curl -X POST -H 'x-api-key: change-me-api-key' -H 'Content-Type: application/json' \
  'http://127.0.0.1:8080/v1/ops/diagnostics' \
  -d '{
    "services":["privacy-calling-api","asterisk","asterisk-full"],
    "levels":["warning","error"],
    "since_sec":900,
    "log_limit":120
  }'
```

### 9.5 安全与行为说明

- 服务端会在把数据发给模型前脱敏 API Key、JWT、手机号和消息正文
- 返回的排查命令以只读诊断为主
- 每次调用都会在 `ops_audit_events` 中记录一条 `ai_diagnostics_requested`
- 如果缺少 `LLM_API_KEY` 或 `LLM_MODEL`，系统会将其视为“未配置”

## 10. 场景 8：注册 SIP 客户端

当你要准备 MicroSIP、Sipnetic 或其他 SIP 软电话参与验收测试时，使用本流程。

### 10.1 先确认隐私拨号路由已经下发

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo asterisk -rx 'dialplan show caller_in'
sudo asterisk -rx 'dialplan show select_virtual'
```

预期结果：

- `caller_in` 存在
- `select_virtual` 存在

### 10.2 演示账号密码

- `alice` / `alice-strong-password`
- `bob` / `bob-strong-password`
- `charlie` / `charlie-strong-password`

### 10.3 通用软电话配置

使用以下值：

- SIP server 或 proxy：`<服务器公网IP>:5160`
- domain：`<服务器公网IP>`，不要带端口
- username：endpoint 名称，例如 `alice`
- authentication user：与 username 相同
- password：对应 endpoint 密码
- transport：`UDP`

不要这样配置：

- 不要在 server 或 proxy 字段里加 `sip:`
- 不要在 domain 字段中填写端口
- 除非你自己扩展了支持，否则 V1 不要启用 TLS 或 SRTP

### 10.4 验证注册状态

```bash
sudo asterisk -rx 'pjsip show contacts'
```

预期结果：

- 已注册 endpoint 显示为 `Avail` 或 `Reachable`

### 10.5 如果注册失败

执行：

```bash
sudo asterisk -rx 'pjsip show endpoints'
sudo asterisk -rx 'pjsip show contacts'
sudo asterisk -rvvv
```

在 Asterisk CLI 中输入：

```text
pjsip set logger on
```

然后在客户端重新发起注册，观察 `REGISTER` 事务和响应码。

### 10.6 特殊情况：`AOR '' not found`

这通常表示客户端发起注册时目标字段不正确。请重新检查：

- username = endpoint 名
- authentication user = endpoint 名
- domain = 仅服务器 IP
- server 或 proxy = 服务器 IP 加端口 `5160`

## 11. 场景 9：客户端直拨隐私通话

当你要在不经过 API 的情况下验证 SIP 客户端之间的隐私通话效果时，使用本流程。

### 11.1 操作方法

Alice 侧可拨：

- `bob`
- `sip:bob@<服务器公网IP>:5160`
- `+8613900000002`

Bob 侧可拨：

- `alice`
- `sip:alice@<服务器公网IP>:5160`
- `+8613900000001`

Alice 呼叫 Charlie 可拨：

- `charlie`
- `sip:charlie@<服务器公网IP>:5160`
- `+8613900000003`

### 11.2 预期结果

- 被叫看到的是虚拟号，而不是主叫真实身份
- 当前部署的 dialplan 中，客户端直拨默认启用隐私保护

### 11.3 单端语音自检

拨打：

- `*900`
- 或者在客户端会吞掉 `*` 的情况下拨 `900`

预期结果：

- 先听到回声测试提示音
- 然后自己的说话内容会被轻微延迟地回放

结果解释：

- 听得到提示音，但听不到自己回声：通常是客户端到 Asterisk 的上行 RTP 有问题
- 连提示音都听不到：通常是 Asterisk 到客户端的下行 RTP 有问题
- 提示音和回声都正常：说明客户端到服务器的音频链路基本正常

## 12. 场景 10：通过 API 发起回拨式隐私通话

当你要测试主控制流程，即通过 `POST /v1/calls` 发起隐私回拨通话时，使用本流程。

### 12.1 前置条件

- 主叫 endpoint 已注册
- API Key 正确
- `privacy-calling-api` 与 Asterisk 正在运行

### 12.2 发起通话

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

如果从其他机器发起调用，请把 `127.0.0.1` 替换为服务器公网 IP，并确保 `8080` 已放行。

### 12.3 预期返回

```json
{
  "call_id": "...",
  "selected_virtual_id": "+8613800011111",
  "status": "originating"
}
```

### 12.4 必须遵守的接听顺序

1. 平台先回拨主叫 endpoint
2. 主叫先接听
3. 平台再呼叫被叫
4. 被叫接听
5. 被叫看到的应是选中的虚拟号

### 12.5 查询通话状态

```bash
curl -sS -H 'x-api-key: my-strong-api-key-001' \
  'http://127.0.0.1:8080/v1/calls/<call_id>'
```

如果你要观察状态流转，可以重复执行。

## 13. 场景 11：解读通话与消息状态

当通话已经创建成功，但实际结果不明确时，可参考本节。

### 13.1 常见通话字段

- `status`：整通电话的总体状态
- `a_leg_status`：主叫侧腿状态
- `b_leg_status`：被叫侧腿状态
- `bridge_status`：`pending`、`bridged` 或 `released`
- `failure_reason`：失败原因

### 13.2 常见通话状态解释

- `a_leg_status=failed`：主叫 endpoint 不在线、配置错误或未接听
- `b_leg_status=failed`：被叫 endpoint 不在线、目标无法解析，或 trunk 不可用
- `status=failed` 且 `failure_reason=trunk_not_configured`：被叫不是本地 SIP 用户，同时没有启用默认 PSTN trunk

### 13.3 查询最近消息状态

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages?limit=20&since_sec=3600'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages?status=failed&limit=20'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages/<message_id>'
```

## 14. 场景 12：启用并测试 SIP MESSAGE 隐私转发

当你要验证客户端之间的隐私文本消息投递时，使用本流程。

### 14.1 检查依赖模块

```bash
sudo asterisk -rx 'module show like app_message'
sudo asterisk -rx 'module show like res_pjsip_messaging'
```

预期结果：

- 两个模块都存在且处于运行状态

### 14.2 下发配置并确认路由

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
sudo asterisk -rx 'dialplan show privacy_message_in'
sudo asterisk -rx 'pjsip show endpoint alice'
```

预期结果：

- `privacy_message_in` 存在
- endpoint 中显示 `message_context = privacy_message_in`

### 14.3 发消息测试

1. 确保发送方和接收方都已注册在线
2. 从 Alice 向 `bob` 或 `+8613900000002` 发送纯文本 SIP MESSAGE
3. 验证 Bob 看到的是虚拟号，而不是 Alice 的真实身份

### 14.4 常见失败原因

- 接收方离线：`target_offline`
- 非纯文本：`invalid_content_type`
- 空消息：`empty_body`
- 消息体超过 1024 字节：`body_too_large`

### 14.5 观察消息状态流转

```bash
sudo asterisk -rvvv
```

推荐的 CLI 命令：

```text
core set verbose 5
core set debug 3
pjsip set logger on
```

你应能看到 `UserEvent: PrivacyMessageState` 的 `created`、`routing`、`delivered`、`failed` 等事件。

## 15. 场景 13：演示区块链鉴权

只有在需要展示钱包签名登录时，才使用本流程。普通验收测试优先使用 API Key，更简单稳定。

### 15.1 推荐模式

建议使用 `AUTH_MODE=hybrid`，这样仍保留 API Key 作为兜底。

### 15.2 配置方法

编辑 `deploy/env/privacy-calling.env`：

```env
AUTH_MODE=hybrid
AUTH_ENABLE_API_KEY_FALLBACK=true
AUTH_JWT_SECRET=change-me-jwt-secret
AUTH_JWT_EXPIRES_SEC=300
AUTH_CHALLENGE_TTL_SEC=60
AUTH_DEMO_MODE=true
AUTH_DEMO_ADDRESS=0x1111111111111111111111111111111111111111
AUTH_DEMO_NODE_ID=demo-node
CHAIN_RPC_URL=http://127.0.0.1:8545
CHAIN_ALLOWLIST_MODE=static
CHAIN_ALLOWED_ADDRESSES=0x1111111111111111111111111111111111111111
```

重启 API：

```bash
sudo systemctl restart privacy-calling-api
```

### 15.3 标准 challenge / verify 流程

先获取 challenge：

```bash
curl 'http://127.0.0.1:8080/v1/auth/challenge?address=0x1111111111111111111111111111111111111111&node_id=node-a'
```

对返回 message 执行 `personal_sign` 后，再提交：

```bash
curl -X POST 'http://127.0.0.1:8080/v1/auth/verify' \
  -H 'Content-Type: application/json' \
  -d '{
    "address":"0x1111111111111111111111111111111111111111",
    "node_id":"node-a",
    "challenge_id":"<challenge_id>",
    "signature":"<wallet_signature>"
  }'
```

使用返回的 JWT：

```bash
curl -H 'Authorization: Bearer <access_token>' \
  'http://127.0.0.1:8080/v1/ops/overview'
```

### 15.4 无钱包演示路径

```bash
curl -X POST 'http://127.0.0.1:8080/v1/auth/demo-login' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

说明：

- 该接口仅在 `AUTH_DEMO_MODE=true` 时可用
- `/dashboard` 也提供 `Demo Login` 按钮
- 此路径仅用于演示，不等于真实钱包验签

## 16. 场景 14：新增用户或批量生成压测账号

当你需要超过默认演示用户数量的 SIP 身份时，使用本流程。

### 16.1 手工新增一个测试用户

1. 在 `deploy/asterisk/pjsip.conf` 中新增 endpoint、auth 与 AOR 配置段。
2. 在 `users` 表中插入用户记录，例如：

```bash
sqlite3 data/privacy.db "
insert into users(id,display_name,real_e164,caller_endpoint,enabled,created_at,updated_at)
values('caller-david','David Caller','+8613900000004','david',1,datetime('now'),datetime('now'));
"
```

3. 重新下发配置并同步 AstDB：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

4. 验证：

```bash
sudo asterisk -rx 'pjsip show endpoint david'
sudo asterisk -rx 'database show pc_users_by_endpoint'
```

说明：

- 现在的直拨目标解析优先使用 AstDB，因此不需要为每个新用户都手工修改 `extensions.conf`
- 对于基础测试，现有虚拟号池即可使用；必要时 API 会自动为被叫创建 callee-to-virtual 映射

### 16.2 批量生成压测用户

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run users:provision -- --count 100
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

批量脚本会生成：

- SQLite 用户数据
- SQLite 虚拟号与映射
- `deploy/asterisk/pjsip.generated.conf`
- `data/generated-users.csv`

### 16.3 可选：用 loadbot 模拟在线用户

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run sip:loadbot -- --port 17060 --auto-bye-ms 1500
```

## 17. 场景 15：启用 SIP 到 PSTN 的通话

只有当你已经拿到真实 trunk 凭据，并且需要测试 SIP 之外的呼叫时，才使用本流程。

### 17.1 修改 Asterisk trunk 配置

编辑 `deploy/asterisk/pjsip.conf`，把 `carrier_out` 的占位值替换成真实参数。

### 17.2 在 SQLite 中启用默认 trunk

```bash
sqlite3 data/privacy.db "update trunks set enabled=1 where name='carrier_out';"
```

### 17.3 应用配置

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo systemctl restart privacy-calling-api
```

## 18. 场景 16：采集日志与排障证据

当你需要排障、留存问题记录，或向其他工程师提供完整证据时，使用本流程。

### 18.1 API 服务日志

```bash
sudo journalctl -u privacy-calling-api -f
```

### 18.2 Asterisk 日志文件

```bash
sudo ls -lh /var/log/asterisk/
sudo tail -n 200 /var/log/asterisk/messages
sudo tail -n 200 /var/log/asterisk/full
```

说明：

- `messages` 一般是 notice、warning、error 级别
- `full` 包含媒体问题排查所需的详细 SIP 与 RTP 日志

### 18.3 Asterisk CLI 调试会话

```bash
sudo asterisk -rvvv
```

常用 CLI 命令：

```text
pjsip show endpoints
pjsip show contacts
core set verbose 5
core set debug 3
pjsip set logger on
rtp set debug on
```

### 18.4 将一段调试窗口输出保存到文件

手工方式：

```bash
sudo asterisk -rx 'core set verbose 5'
sudo asterisk -rx 'core set debug 3'
sudo asterisk -rx 'pjsip set logger on'
sudo asterisk -rx 'rtp set debug on'
sudo timeout 120 tail -f /var/log/asterisk/full | tee /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log
```

脚本方式：

```bash
cd /home/ubuntu/fyp/PrivacyCalling
./scripts/capture-audio-debug.sh /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log 120
```

### 18.5 从 SQLite 查询最近通话

```bash
sqlite3 data/privacy.db "select id,status,created_at,failure_reason from calls order by created_at desc limit 10;"
```

## 19. 场景 17：常见故障与恢复动作

本节用于按症状快速定位问题。

### 19.1 所有受保护 API 都返回 `401`

可能原因：

- `x-api-key` 与 `deploy/env/privacy-calling.env` 中的 `API_KEY` 不一致

处理动作：

1. 重新确认服务端 `API_KEY`
2. 如果改过值，重启 `privacy-calling-api`
3. 请求头中使用完全相同的值

### 19.2 SIP 客户端无法注册

可能原因：

- 用户名或密码错误
- server、proxy 或 domain 字段填写错误
- domain 中错误地包含了端口
- server 字段里错误地填写了 `sip:`

处理动作：

1. 执行 `sudo asterisk -rx 'pjsip show contacts'`
2. 开启 `pjsip set logger on`
3. 重新发起注册并检查 `REGISTER` 事务

### 19.3 通话已创建，但很快失败

可能原因：

- 主叫 endpoint 未注册
- `caller_user_id` 错误
- 被叫目标无法解析
- 呼叫外部目标时没有可用默认 trunk

处理动作：

1. 用 `pjsip show contacts` 确认主叫在线
2. 确认 `caller_user_id` 在 SQLite 中存在
3. 对 SIP-to-SIP 测试，确保 `callee_e164` 对应本地用户
4. 若测试 PSTN，则启用并配置默认 trunk

### 19.4 通话接通但没有声音

可能原因：

- `pjsip.conf` 中的公网 IP 错误
- 云防火墙或安全组拦截 RTP
- ACK 或 RTP 没有到达服务器

处理动作：

1. 检查 transport：

```bash
sudo asterisk -rx 'pjsip show transport transport-udp-privacy'
```

2. 确认 `external_signaling_address` 与 `external_media_address` 与真实公网 IP 一致
3. 确认放通 UDP `5160` 与 UDP `20000-20199`
4. 开启 `pjsip set logger on`，检查 `200 OK` 中 SDP 的 `c=` 地址
5. 开启 `rtp set debug on`，确认同时存在发送和接收的 RTP 包

### 19.5 `trunk_not_configured`

可能原因：

- 被叫不是本地 SIP 用户，同时系统中没有启用的默认 trunk

处理动作：

1. 若测试 SIP-to-SIP，请改拨本地演示号码，例如 `+8613900000002`
2. 若测试 PSTN，请完成 `carrier_out` 配置并启用

### 19.6 面板能看状态，但不能控制服务

可能原因：

- `ubuntu` 用户没有对应 `systemctl` 操作的免密 sudo 权限

处理动作：

- 按第 8.4 节执行 sudoers 修复

### 19.7 SIP MESSAGE 投递失败

可能原因：

- 目标离线
- 内容不是纯文本
- 消息为空
- 消息体过大

处理动作：

1. 确认双方 endpoint 在线
2. 确认内容类型为 `text/plain`
3. 通过 `/v1/messages` 查看最近消息状态

## 20. 场景 18：不通过 systemd 的本地开发模式

如果你只想在开发阶段手工启动 API，可使用本流程。

### 20.1 在当前 shell 中启动 API

```bash
cd /home/ubuntu/fyp/PrivacyCalling
set -a
. deploy/env/privacy-calling.env
set +a
npm start
```

### 20.2 补充说明

- Asterisk 仍需单独安装并运行
- 这种模式适合本地迭代开发和直接看控制台输出
- 在正式验收和演示场景中，仍建议优先使用 systemd 模式
