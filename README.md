# Privacy Calling Server V1

轻量化隐私通话服务端（非 Docker），基于：
- Asterisk（SIP/RTP/桥接）
- Node.js（控制面 API）
- SQLite（用户、虚拟号池、会话与映射）

## 功能覆盖
- `POST /v1/calls` 回拨式发起隐私通话
- `GET /v1/calls/{id}` 查询会话状态
- `GET /health` 健康检查
- `GET /dashboard` Material You 风格运维面板（服务状态/快捷操作）
- Dashboard V2：告警中心、服务器负载曲线、分级日志高亮、操作审计时间线
- 运维面板“最近通话”同时覆盖 API 回拨与客户端直拨
- `GET /v1/capacity/engset` Engset 阻塞概率计算
- `GET /v1/capacity/privacy-exhaustion` 虚拟号耗尽概率计算
- 认证：静态 API Key（`x-api-key`）
- 区块链鉴权 PoC：`/v1/auth/challenge` + `/v1/auth/verify`（返回 JWT Bearer）
- 选号策略 `Φ`：按被叫一致性映射，忙线时回退可用虚拟号

## 目录结构
- `src/` Node.js 服务源码
- `src/db/schema.sql` SQLite 表结构（users, virtual_numbers, trunks, calls, call_legs, id_mappings）
- `deploy/asterisk/` Asterisk 配置模板
- `deploy/systemd/` systemd 单元文件
- `scripts/` 初始化、部署脚本
- `test/` 单元与集成测试

## 快速开始
1. 安装依赖
```bash
npm install
```

2. 初始化数据库并写入演示数据
```bash
npm run db:init
npm run db:seed
```

3. 配置环境变量
```bash
cp .env.example deploy/env/privacy-calling.env
# 编辑 API_KEY / AMI_SECRET 等
```

4. 启动 API（开发方式）
```bash
export $(grep -v '^#' deploy/env/privacy-calling.env | xargs)
npm start
```

## Asterisk 部署
1. 安装系统组件（root）
```bash
sudo ./scripts/install-system.sh
```

2. 修改 `deploy/asterisk/pjsip.conf`
- 替换 `YOUR_PUBLIC_IP`
- 修改 `alice/bob` 密码
- 如需运营商外呼，填入 `carrier_out` 真实凭据

3. 下发配置并重启 Asterisk（root）
```bash
sudo ./scripts/deploy-asterisk-config.sh
```

4. systemd 托管 Node API（root）
```bash
sudo ./scripts/install-systemd-service.sh
```

5. 可选：允许面板一键启停服务（root）
```bash
SYSTEMCTL_BIN="$(command -v systemctl)"
echo "ubuntu ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} start asterisk, ${SYSTEMCTL_BIN} stop asterisk, ${SYSTEMCTL_BIN} restart asterisk, ${SYSTEMCTL_BIN} start privacy-calling-api, ${SYSTEMCTL_BIN} stop privacy-calling-api, ${SYSTEMCTL_BIN} restart privacy-calling-api" | sudo tee /etc/sudoers.d/privacy-calling-ops
sudo chmod 440 /etc/sudoers.d/privacy-calling-ops
```
说明：如果不做这步，`/dashboard` 仍可查看状态，但“启动/停止/重启”按钮会提示权限不足。

## API 示例
### 发起呼叫
```bash
curl -X POST 'http://127.0.0.1:8080/v1/calls' \
  -H 'x-api-key: change-me-api-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "caller_user_id": "caller-alice",
    "callee_e164": "+8613900000002",
    "timeout_sec": 30
  }'
```

### 查询呼叫状态
```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/calls/<call_id>'
```

### 运维面板概览
```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/overview'
```

### 运维日志查询
```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/logs?services=privacy-calling-api,asterisk,asterisk-full&levels=warning,error&since_sec=600&limit=100'
```

### 运维审计事件
```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/audit-events?limit=20'

curl -X POST -H 'x-api-key: change-me-api-key' -H 'Content-Type: application/json' \
  'http://127.0.0.1:8080/v1/ops/audit-events' \
  -d '{"action":"logs_manual_refresh","target":"dashboard.logs","result":"success","details":{"source":"manual"}}'
```

### 容量计算
```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/capacity/engset?N=200&C=60&beta=0.08'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/capacity/privacy-exhaustion?N=1000&p=0.02&M=30'
```

## 区块链鉴权最小演示（PoC）
1. 在 `deploy/env/privacy-calling.env` 配置（建议先用 `hybrid`，保留 API Key 兜底）：
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

2. 重启服务：
```bash
sudo systemctl restart privacy-calling-api
```

3. 获取 challenge：
```bash
curl 'http://127.0.0.1:8080/v1/auth/challenge?address=0x1111111111111111111111111111111111111111&node_id=node-a'
```

4. 钱包对返回的 `message` 做 `personal_sign`，得到 `signature`。

5. 提交验签换取 JWT：
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

6. 使用 Bearer 调用受保护接口：
```bash
curl -H 'Authorization: Bearer <access_token>' \
  'http://127.0.0.1:8080/v1/ops/overview'
```

无钱包快速演示（推荐）：
```bash
curl -X POST 'http://127.0.0.1:8080/v1/auth/demo-login' -H 'Content-Type: application/json' -d '{}'
```
返回 `access_token` 后同样用 `Authorization: Bearer ...` 访问受保护接口。  
前端 `/dashboard` 也可直接点击“Demo 登录（免钱包）”按钮。

说明：
1. `AUTH_MODE=api_key` 时，行为与旧版一致，仅支持 `x-api-key`。
2. `AUTH_MODE=hybrid` 时，支持 Bearer 和 API Key（可选 fallback）。
3. `AUTH_MODE=blockchain` 时，仅支持 Bearer（默认不回退 API Key）。

## SIP 呼叫流程（V1）
1. API 发起任务，选取虚拟号 `id_v`
2. AMI `Originate` 先呼叫 Caller（A-leg）
3. A-leg 接通后进入 `privacy_bridge`，拨 B-leg
4. B-leg 呼叫时设置 `CALLERID(num)=id_v`
5. A/B 桥接后通话，AMI `UserEvent` 回写状态到 SQLite

## 说明
- V1 默认 `SIP/UDP + RTP`，未启用 TLS/SRTP。
- WebRTC/STUN/TURN 在本版仅做扩展预留。
- 若 `trunks` 未启用默认 Trunk，会尝试将被叫号码匹配为本地 SIP 用户（SIP↔SIP 验收路径）。
- 验收实操请看 `docs/Runbook.md`。
