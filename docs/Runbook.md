# Privacy Calling Operations Runbook

Chinese copy: `docs/Runbook.zh-CN.md`

This runbook is the standard operating guide for the non-Docker Privacy Calling deployment used in the project acceptance environment. It is organized by scenario so an operator can quickly choose the right procedure for the situation at hand.

## 1. Scope

This deployment consists of:

- `asterisk`: SIP signaling, RTP media handling, and call bridging
- `privacy-calling-api`: Node.js control-plane API and operations dashboard
- `SQLite`: local data store at `data/privacy.db`

Core capabilities covered by this runbook:

- direct SIP client dialing with privacy masking
- API-triggered callback privacy calls through `POST /v1/calls`
- SIP MESSAGE privacy relay
- operations dashboard at `/dashboard`
- optional AI diagnostics
- optional blockchain-based demo authentication

## 2. Standard Services, Files, and Demo Data

### 2.1 Systemd services

- `asterisk`
- `privacy-calling-api`

### 2.2 Main files

- environment file: `deploy/env/privacy-calling.env`
- environment template: `deploy/env/privacy-calling.env.example`
- Asterisk SIP config: `deploy/asterisk/pjsip.conf`
- Asterisk dialplan: `deploy/asterisk/extensions.conf`
- Asterisk RTP config: `deploy/asterisk/rtp.conf`
- database: `data/privacy.db`

### 2.3 Default demo identities after `npm run db:seed`

- API callers:
  - `caller-alice` -> endpoint `alice` -> real number `+8613900000001`
  - `caller-charlie` -> endpoint `charlie` -> real number `+8613900000003`
- Demo callee:
  - `callee-bob` -> endpoint `bob` -> real number `+8613900000002`
- Demo virtual numbers:
  - `+8613800011111`
  - `+8613800011112`
  - `+8613800011113`

Important distinction:

- API calls use `caller_user_id`, such as `caller-alice`
- SIP clients register with endpoint credentials, such as `alice` or `bob`
- the server-side API key is defined in `deploy/env/privacy-calling.env`
- API clients must send the same value in the `x-api-key` header

## 3. Scenario 1: First-Time Deployment or Full Reset

Use this procedure when setting up a new server, rebuilding a test environment, or reinitializing the project from scratch.

### 3.1 Procedure

1. Install system dependencies:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/install-system.sh
```

2. Install Node.js dependencies:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm install
```

3. Create the environment file if it does not already exist:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
cp deploy/env/privacy-calling.env.example deploy/env/privacy-calling.env
```

4. Edit `deploy/env/privacy-calling.env` and set at least:

- `API_KEY`
- `ASTERISK_AMI_SECRET`
- `AUTH_MODE` if you do not want the default behavior
- optional `LLM_*` values if AI diagnostics will be used

5. Edit `deploy/asterisk/pjsip.conf` and verify at least:

- `external_signaling_address` matches the server public IP
- `external_media_address` matches the server public IP
- endpoint passwords for `alice`, `bob`, and `charlie`
- trunk placeholder values if PSTN testing is planned

Note: the repository currently contains a concrete public IP in `deploy/asterisk/pjsip.conf`. Replace it if your server IP is different.

6. Initialize and seed the database:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run db:init
npm run db:seed
```

7. Deploy Asterisk configuration and sync AstDB:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

8. Install and start the API systemd service:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/install-systemd-service.sh
```

### 3.2 Verification

Run:

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
curl -sS http://127.0.0.1:8080/health
sudo asterisk -rx 'pjsip show endpoints'
```

Expected result:

- both services are `active (running)`
- `/health` returns `status: ok`
- demo endpoints such as `alice`, `bob`, and `charlie` appear in the endpoint list

## 4. Scenario 2: Start, Stop, Restart, and Autostart Control

Use this procedure for normal service control during testing, maintenance, or demonstrations.

### 4.1 Stop services without changing autostart

```bash
sudo systemctl stop privacy-calling-api
sudo systemctl stop asterisk
```

### 4.2 Start services

Start Asterisk first, then the API:

```bash
sudo systemctl start asterisk
sudo systemctl start privacy-calling-api
```

### 4.3 Restart services

```bash
sudo systemctl restart asterisk
sudo systemctl restart privacy-calling-api
```

### 4.4 Check current status

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
```

### 4.5 Disable autostart at boot

```bash
sudo systemctl disable --now privacy-calling-api asterisk
```

### 4.6 Re-enable autostart and start immediately

```bash
sudo systemctl enable --now asterisk privacy-calling-api
```

## 5. Scenario 3: Baseline Health Check Before Testing

Use this procedure before an acceptance demo, before troubleshooting a client issue, or after any restart.

### 5.1 Procedure

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo systemctl status asterisk privacy-calling-api --no-pager
sudo asterisk -rx 'core show version'
sudo asterisk -rx 'pjsip show endpoints'
sudo asterisk -rx 'pjsip show contacts'
curl -sS http://127.0.0.1:8080/health
```

### 5.2 Expected result

- both systemd services are running
- `pjsip show endpoints` lists expected endpoints
- registered clients appear in `pjsip show contacts`
- `/health` reports both database and AMI as healthy

### 5.3 If the health check fails

- if `privacy-calling-api` is down, inspect `journalctl -u privacy-calling-api`
- if Asterisk is down, inspect `systemctl status asterisk` and Asterisk logs
- if AMI is unhealthy, verify `ASTERISK_AMI_*` values in `deploy/env/privacy-calling.env`
- if no contacts are shown, the SIP clients are not registered yet

## 6. Scenario 4: Apply Configuration Changes Safely

Use this procedure after editing environment variables, Asterisk configuration, or database-backed user mappings.

### 6.1 API environment changes

Examples:

- `API_KEY`
- `AUTH_*`
- `LLM_*`
- `ASTERISK_AMI_*`

Apply:

```bash
sudo systemctl restart privacy-calling-api
sudo systemctl status privacy-calling-api --no-pager
```

### 6.2 Asterisk SIP or dialplan changes

Examples:

- `deploy/asterisk/pjsip.conf`
- `deploy/asterisk/extensions.conf`
- `deploy/asterisk/rtp.conf`
- `deploy/asterisk/logger.conf`

Apply:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
```

### 6.3 SQLite user, virtual number, or mapping changes

If you changed database-backed user data that should be visible to the dialplan, sync AstDB:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/sync-asterisk-astdb.sh
```

### 6.4 Recommended post-change validation

```bash
sudo asterisk -rx 'dialplan show caller_in'
sudo asterisk -rx 'dialplan show resolve_target'
sudo asterisk -rx 'dialplan show select_virtual'
sudo asterisk -rx 'pjsip show endpoints'
curl -sS http://127.0.0.1:8080/health
```

## 7. Scenario 5: Configure or Rotate the API Key

Use this procedure when the API key must be set for the first time or rotated for security reasons.

### 7.1 Update the server-side API key

Edit `deploy/env/privacy-calling.env`:

```env
API_KEY=my-strong-api-key-001
```

### 7.2 Restart the API service

```bash
sudo systemctl restart privacy-calling-api
sudo systemctl status privacy-calling-api --no-pager
```

### 7.3 Use the same value in client requests

All protected API requests must include:

```bash
-H 'x-api-key: my-strong-api-key-001'
```

### 7.4 Expected failure mode

If the header value and the server value do not match, the API returns `401`.

## 8. Scenario 6: Use the Operations Dashboard

Use this procedure when you want a quick operational overview or simple service control through the browser.

### 8.1 Access URLs

- local: `http://127.0.0.1:8080/dashboard`
- remote: `http://<SERVER_PUBLIC_IP>:8080/dashboard`

### 8.2 What the dashboard provides

- service status for `asterisk` and `privacy-calling-api`
- API, database, and AMI health indicators
- recent calls
- alert center
- server load charts
- structured logs with level filtering
- audit event timeline
- optional AI diagnostics

### 8.3 Authentication

Enter the same API key value configured in `deploy/env/privacy-calling.env`.

### 8.4 If service-control buttons fail with a permission error

The `ubuntu` user needs passwordless `systemctl` permission for the managed services:

```bash
SYSTEMCTL_BIN="$(command -v systemctl)"
echo "ubuntu ALL=(root) NOPASSWD: ${SYSTEMCTL_BIN} start asterisk, ${SYSTEMCTL_BIN} stop asterisk, ${SYSTEMCTL_BIN} restart asterisk, ${SYSTEMCTL_BIN} start privacy-calling-api, ${SYSTEMCTL_BIN} stop privacy-calling-api, ${SYSTEMCTL_BIN} restart privacy-calling-api" | sudo tee /etc/sudoers.d/privacy-calling-ops
sudo chmod 440 /etc/sudoers.d/privacy-calling-ops
sudo systemctl restart privacy-calling-api
```

### 8.5 Useful dashboard-related API endpoints

Logs:

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/logs?services=privacy-calling-api,asterisk,asterisk-full&levels=warning,error&since_sec=600&limit=100'
```

Audit events:

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/audit-events?limit=30'
```

## 9. Scenario 7: Configure and Use AI Diagnostics

Use this procedure when the dashboard or API should summarize service state, alerts, logs, and audit data with an LLM.

### 9.1 Configuration

Edit `deploy/env/privacy-calling.env`:

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

Notes:

- the service sends OpenAI-compatible `POST /chat/completions` requests to `LLM_BASE_URL`
- you may point `LLM_BASE_URL` to another compatible gateway
- the example deployment file in this repository currently uses DeepSeek-style values; that is acceptable as long as the upstream is compatible

### 9.2 Apply changes

```bash
sudo systemctl restart privacy-calling-api
```

### 9.3 Use from the dashboard

1. Open `/dashboard`
2. authenticate with the API key or demo login if enabled
3. click `AI Diagnostics`
4. review the summary, findings, and suggested shell commands

### 9.4 Use from the API

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

### 9.5 Security and behavior notes

- the server redacts API keys, JWTs, phone numbers, and message bodies before sending data to the model
- diagnostic commands are intended to be read-only investigation commands
- each request is recorded in `ops_audit_events` with action `ai_diagnostics_requested`
- if `LLM_API_KEY` or `LLM_MODEL` is missing, diagnostics are treated as not configured

## 10. Scenario 8: Register SIP Clients

Use this procedure when preparing MicroSIP, Sipnetic, or another SIP softphone for acceptance testing.

### 10.1 Ensure privacy dialplan is deployed

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo asterisk -rx 'dialplan show caller_in'
sudo asterisk -rx 'dialplan show select_virtual'
```

Expected result:

- `caller_in` exists
- `select_virtual` exists

### 10.2 Demo account credentials

- `alice` / `alice-strong-password`
- `bob` / `bob-strong-password`
- `charlie` / `charlie-strong-password`

### 10.3 Generic softphone settings

Use the following values:

- SIP server or proxy: `<SERVER_PUBLIC_IP>:5160`
- domain: `<SERVER_PUBLIC_IP>` without the port
- username: endpoint name, such as `alice`
- authentication user: same as username
- password: endpoint password
- transport: `UDP`

Do not:

- add the `sip:` prefix in the server or proxy field
- put the port in the domain field
- enable TLS or SRTP for this V1 deployment unless you have added support yourself

### 10.4 Verify registration

```bash
sudo asterisk -rx 'pjsip show contacts'
```

Expected result:

- the registered endpoint appears as `Avail` or `Reachable`

### 10.5 If registration fails

Run:

```bash
sudo asterisk -rx 'pjsip show endpoints'
sudo asterisk -rx 'pjsip show contacts'
sudo asterisk -rvvv
```

Inside the Asterisk CLI:

```text
pjsip set logger on
```

Then register again from the client and inspect the `REGISTER` transaction and response codes.

### 10.6 Special case: `AOR '' not found`

This usually means the client sent an invalid registration target. Re-check:

- username = endpoint name
- authentication user = endpoint name
- domain = server IP only
- server or proxy = server IP with port `5160`

## 11. Scenario 9: Place a Direct SIP Privacy Call

Use this procedure when testing privacy masking between SIP clients without using the API.

### 11.1 Procedure

From Alice, dial any of the following:

- `bob`
- `sip:bob@<SERVER_PUBLIC_IP>:5160`
- `+8613900000002`

From Bob, dial any of the following:

- `alice`
- `sip:alice@<SERVER_PUBLIC_IP>:5160`
- `+8613900000001`

From Alice to Charlie:

- `charlie`
- `sip:charlie@<SERVER_PUBLIC_IP>:5160`
- `+8613900000003`

### 11.2 Expected result

- the callee sees a virtual number, not the caller's real identity
- direct client dialing is privacy-protected by default in the deployed dialplan

### 11.3 Single-endpoint audio check

Dial:

- `*900`
- or `900` if the client strips `*`

Expected result:

- you hear the echo-test prompt
- after the prompt, your own voice is played back with slight delay

Interpretation:

- prompt heard, but no voice loopback: upstream RTP from client to Asterisk is probably broken
- no prompt at all: downstream RTP from Asterisk to client is probably broken
- both prompt and loopback work: the client-to-server audio path is healthy

## 12. Scenario 10: Place an API-Triggered Privacy Callback Call

Use this procedure when testing the main control-plane call flow through `POST /v1/calls`.

### 12.1 Preconditions

- the caller endpoint is registered
- the API key is correct
- `privacy-calling-api` and Asterisk are running

### 12.2 Trigger the call

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

If you call from another machine, replace `127.0.0.1` with the server public IP and ensure port `8080` is reachable.

### 12.3 Expected response

```json
{
  "call_id": "...",
  "selected_virtual_id": "+8613800011111",
  "status": "originating"
}
```

### 12.4 Required answer order

1. the platform first calls the caller endpoint
2. the caller answers
3. the platform then rings the callee
4. the callee answers
5. the callee should see the selected virtual number

### 12.5 Query call state

```bash
curl -sS -H 'x-api-key: my-strong-api-key-001' \
  'http://127.0.0.1:8080/v1/calls/<call_id>'
```

Run it repeatedly if you want to watch state transitions.

## 13. Scenario 11: Interpret Call and Message Status

Use this section when the call was created successfully but the result is unclear.

### 13.1 Common call status fields

- `status`: overall call state
- `a_leg_status`: caller-side leg
- `b_leg_status`: callee-side leg
- `bridge_status`: `pending`, `bridged`, or `released`
- `failure_reason`: failure cause when available

### 13.2 Typical call status interpretation

- `a_leg_status=failed`: caller endpoint was unavailable, misconfigured, or unanswered
- `b_leg_status=failed`: callee endpoint was unavailable, the target could not be resolved, or the trunk was unavailable
- `status=failed` with `failure_reason=trunk_not_configured`: the target was not a local SIP user and no default PSTN trunk was enabled

### 13.3 Query recent messages

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages?limit=20&since_sec=3600'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages?status=failed&limit=20'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/messages/<message_id>'
```

## 14. Scenario 12: Enable and Test SIP MESSAGE Privacy Relay

Use this procedure when validating privacy-protected text delivery between SIP clients.

### 14.1 Verify required modules

```bash
sudo asterisk -rx 'module show like app_message'
sudo asterisk -rx 'module show like res_pjsip_messaging'
```

Expected result:

- both modules are present and running

### 14.2 Deploy and confirm routing

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
sudo asterisk -rx 'dialplan show privacy_message_in'
sudo asterisk -rx 'pjsip show endpoint alice'
```

Expected result:

- `privacy_message_in` exists
- the endpoint shows `message_context = privacy_message_in`

### 14.3 Send a message

1. ensure the sender and receiver are both registered
2. send a plain-text SIP message from Alice to `bob` or `+8613900000002`
3. verify that Bob sees a virtual number as the sender identity

### 14.4 Expected failure reasons

- receiver offline: `target_offline`
- non-plain-text content: `invalid_content_type`
- empty body: `empty_body`
- oversized body over 1024 bytes: `body_too_large`

### 14.5 Observe message state transitions

```bash
sudo asterisk -rvvv
```

Recommended CLI commands:

```text
core set verbose 5
core set debug 3
pjsip set logger on
```

You should see `UserEvent: PrivacyMessageState` events such as `created`, `routing`, `delivered`, and `failed`.

## 15. Scenario 13: Demo Blockchain Authentication

Use this procedure only if you need to demonstrate wallet-based login. For normal acceptance work, API key authentication is simpler.

### 15.1 Recommended mode

Use `AUTH_MODE=hybrid` so API key access remains available as a fallback.

### 15.2 Configuration

Edit `deploy/env/privacy-calling.env`:

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

Restart the API:

```bash
sudo systemctl restart privacy-calling-api
```

### 15.3 Challenge and verify flow

Get a challenge:

```bash
curl 'http://127.0.0.1:8080/v1/auth/challenge?address=0x1111111111111111111111111111111111111111&node_id=node-a'
```

Sign the returned message with `personal_sign`, then submit:

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

Use the returned JWT:

```bash
curl -H 'Authorization: Bearer <access_token>' \
  'http://127.0.0.1:8080/v1/ops/overview'
```

### 15.4 No-wallet demo path

```bash
curl -X POST 'http://127.0.0.1:8080/v1/auth/demo-login' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Notes:

- this endpoint only works when `AUTH_DEMO_MODE=true`
- `/dashboard` also provides a `Demo Login` button
- this path is for demonstration only, not real wallet verification

## 16. Scenario 14: Add Users or Provision Scale-Test Accounts

Use this procedure when you need more SIP identities than the built-in demo users.

### 16.1 Add one manual test user

1. Add endpoint, auth, and AOR sections to `deploy/asterisk/pjsip.conf`.
2. Insert a row into the `users` table. Example:

```bash
sqlite3 data/privacy.db "
insert into users(id,display_name,real_e164,caller_endpoint,enabled,created_at,updated_at)
values('caller-david','David Caller','+8613900000004','david',1,datetime('now'),datetime('now'));
"
```

3. Re-deploy Asterisk config and sync AstDB:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

4. Verify:

```bash
sudo asterisk -rx 'pjsip show endpoint david'
sudo asterisk -rx 'database show pc_users_by_endpoint'
```

Notes:

- direct dial resolution now prefers AstDB, so you do not need to hard-code every new user into `extensions.conf`
- existing virtual numbers are enough for basic testing; the API can create a callee-to-virtual mapping automatically when needed

### 16.2 Provision many users for scale testing

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run users:provision -- --count 100
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

Artifacts generated by the provision script:

- SQLite user records
- SQLite virtual numbers and mappings
- `deploy/asterisk/pjsip.generated.conf`
- `data/generated-users.csv`

### 16.3 Optional loadbot for simulated online users

```bash
cd /home/ubuntu/fyp/PrivacyCalling
npm run sip:loadbot -- --port 17060 --auto-bye-ms 1500
```

## 17. Scenario 15: Enable SIP-to-PSTN Calls

Use this procedure only if you have real trunk credentials and want to test beyond SIP-to-SIP calling.

### 17.1 Update Asterisk trunk settings

Edit `deploy/asterisk/pjsip.conf` and replace the placeholder `carrier_out` values with real credentials.

### 17.2 Enable the default trunk in SQLite

```bash
sqlite3 data/privacy.db "update trunks set enabled=1 where name='carrier_out';"
```

### 17.3 Apply changes

```bash
cd /home/ubuntu/fyp/PrivacyCalling
sudo ./scripts/deploy-asterisk-config.sh
sudo systemctl restart privacy-calling-api
```

## 18. Scenario 16: Collect Logs and Evidence

Use this procedure when you need to troubleshoot, keep incident records, or share evidence with another engineer.

### 18.1 API service logs

```bash
sudo journalctl -u privacy-calling-api -f
```

### 18.2 Asterisk log files

```bash
sudo ls -lh /var/log/asterisk/
sudo tail -n 200 /var/log/asterisk/messages
sudo tail -n 200 /var/log/asterisk/full
```

Notes:

- `messages` usually contains notice, warning, and error level output
- `full` contains the detailed SIP and RTP traces needed for media debugging

### 18.3 Asterisk CLI debug session

```bash
sudo asterisk -rvvv
```

Useful CLI commands:

```text
pjsip show endpoints
pjsip show contacts
core set verbose 5
core set debug 3
pjsip set logger on
rtp set debug on
```

### 18.4 Capture a focused debug window to a file

Manual method:

```bash
sudo asterisk -rx 'core set verbose 5'
sudo asterisk -rx 'core set debug 3'
sudo asterisk -rx 'pjsip set logger on'
sudo asterisk -rx 'rtp set debug on'
sudo timeout 120 tail -f /var/log/asterisk/full | tee /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log
```

Scripted method:

```bash
cd /home/ubuntu/fyp/PrivacyCalling
./scripts/capture-audio-debug.sh /home/ubuntu/fyp/PrivacyCalling/pjsip_rtp_capture.log 120
```

### 18.5 Query recent calls from SQLite

```bash
sqlite3 data/privacy.db "select id,status,created_at,failure_reason from calls order by created_at desc limit 10;"
```

## 19. Scenario 17: Common Incidents and Recovery Actions

Use this section for fast symptom-based troubleshooting.

### 19.1 All protected API requests return `401`

Likely cause:

- the `x-api-key` header does not match `API_KEY` in `deploy/env/privacy-calling.env`

Action:

1. re-check the server-side `API_KEY`
2. restart `privacy-calling-api` if you changed it
3. send the exact same value in the request header

### 19.2 SIP client cannot register

Likely causes:

- wrong username or password
- wrong server, proxy, or domain field
- domain includes the port
- server field includes `sip:`

Action:

1. run `sudo asterisk -rx 'pjsip show contacts'`
2. enable `pjsip set logger on`
3. repeat registration and inspect the `REGISTER` transaction

### 19.3 Call is created but fails quickly

Likely causes:

- caller endpoint not registered
- wrong `caller_user_id`
- callee cannot be resolved
- no default trunk for non-local targets

Action:

1. verify caller registration with `pjsip show contacts`
2. verify `caller_user_id` exists in SQLite
3. verify the callee E.164 matches a local user for SIP-to-SIP testing
4. if testing PSTN, enable and configure the default trunk

### 19.4 Connected call has no audio

Likely causes:

- public IP in `pjsip.conf` is wrong
- cloud firewall or security group blocks RTP
- ACK or RTP is not reaching the server

Action:

1. check transport settings:

```bash
sudo asterisk -rx 'pjsip show transport transport-udp-privacy'
```

2. verify that `external_signaling_address` and `external_media_address` match the real server public IP
3. confirm that UDP `5160` and UDP `20000-20199` are open
4. enable `pjsip set logger on` and inspect the SDP `c=` address in `200 OK`
5. enable `rtp set debug on` and verify both sent and received RTP packets are present

### 19.5 `trunk_not_configured`

Likely cause:

- the callee was not a local SIP user and no enabled default trunk was available

Action:

1. for SIP-to-SIP testing, call a local demo number such as `+8613900000002`
2. for PSTN, configure and enable `carrier_out`

### 19.6 Dashboard can read status but cannot control services

Likely cause:

- the `ubuntu` user does not have passwordless permission for the required `systemctl` actions

Action:

- apply the sudoers fix described in Section 8.4

### 19.7 SIP MESSAGE delivery fails

Likely causes:

- target offline
- non-plain-text content
- empty body
- oversized body

Action:

1. verify both endpoints are online
2. confirm content type is `text/plain`
3. inspect recent message status through `/v1/messages`

## 20. Scenario 18: Local Development Without Systemd

Use this procedure if you only want to run the API manually during development.

### 20.1 Start the API in the current shell

```bash
cd /home/ubuntu/fyp/PrivacyCalling
set -a
. deploy/env/privacy-calling.env
set +a
npm start
```

### 20.2 Notes

- Asterisk still needs to be installed and running separately
- this mode is useful for iterative development and console logging
- systemd remains the preferred mode for acceptance testing and demos
