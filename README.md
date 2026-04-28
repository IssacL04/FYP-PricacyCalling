<div align="center">
  <h1>ChatCatHat</h1>
  <p><strong>An AI-powered lightweight privacy-calling server.</strong></p>
  <p>
    ChatCatHat is a Linux-first privacy-calling backend built on Asterisk, Node.js, and SQLite.
    It masks caller identity with virtual numbers, exposes a clean REST control plane, and ships
    with an operations dashboard, audit trail, and optional AI-assisted diagnostics.
  </p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+">
    <img src="https://img.shields.io/badge/Asterisk-SIP%20%2F%20RTP-F68B1F" alt="Asterisk SIP RTP">
    <img src="https://img.shields.io/badge/SQLite-Local%20State-003B57?logo=sqlite&logoColor=white" alt="SQLite">
    <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express 5">
    <img src="https://img.shields.io/badge/AI-OpenAI--compatible-0A7C66" alt="OpenAI compatible AI diagnostics">
    <img src="https://img.shields.io/badge/Deploy-Non--Docker-6C757D" alt="Non-Docker deployment">
  </p>
  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#api-snapshot">API</a> •
    <a href="#docs">Docs</a>
  </p>
</div>

## Overview

ChatCatHat is designed for privacy-calling demos, research prototypes, and acceptance environments where you need a lightweight server that can:

- accept a call request from an authenticated caller
- select a privacy-safe virtual number
- bridge the call through Asterisk while hiding the caller's real identity
- expose service health, logs, metrics, and recent activity through a web dashboard
- optionally use an OpenAI-compatible LLM to summarize incidents and suggest operator actions

This repository is intentionally non-Docker and optimized for direct Linux deployment with `systemd`, local SQLite state, and scriptable Asterisk configuration.

## Features

- Privacy callback API via `POST /v1/calls`
- Direct SIP dialing with masked caller ID using dynamic AstDB-backed mappings
- SIP MESSAGE privacy relay with delivery-state tracking
- Web operations dashboard at `/dashboard`
- Service control, logs, audit events, and alert summaries for operators
- AI diagnostics over redacted logs and runtime state
- Hybrid authentication flow: API key, JWT bearer, and blockchain-auth demo PoC
- Capacity modeling endpoints for Engset blocking and privacy-number exhaustion
- Bulk user provisioning, load simulation, and predictive-scaling scripts
- Android SIP client MVP included under [`client/android-sip-client`](client/android-sip-client)

## Architecture

| Layer | Responsibility |
| --- | --- |
| `client/` | SIP client app and external API consumers |
| `src/` | Node.js control plane, auth, call orchestration, dashboard, ops APIs |
| `deploy/asterisk/` | Asterisk SIP, RTP, dialplan, and manager configuration |
| `SQLite` | users, virtual numbers, calls, call legs, mappings, messages, ops audit |
| `scripts/` | install, seed, provisioning, benchmarking, and deployment helpers |

```text
Caller App / SIP Client / REST Client
                 |
                 v
      Node.js API + Auth + Dashboard
          |            |            \
          |            |             +--> AI diagnostics (optional)
          |            |
          |            +--> SQLite state
          |
          +--> Asterisk AMI + Dialplan + SIP/RTP
                               |
                               v
                    SIP endpoints / carrier trunk / callee
```

## Quick Start

### 1. Local bootstrap

Install dependencies, create the environment file, seed demo data, and start the API:

```bash
npm install
cp deploy/env/privacy-calling.env.example deploy/env/privacy-calling.env
npm run db:init
npm run db:seed
set -a
source deploy/env/privacy-calling.env
set +a
npm start
```

Then open:

- Dashboard: `http://127.0.0.1:8080/dashboard`
- Health check: `http://127.0.0.1:8080/health`

Note: the API can boot without a live Asterisk connection for local UI and API exploration, but real call routing requires the full telephony setup below.

### 2. Full telephony setup

Before deploying, edit:

- `deploy/env/privacy-calling.env`
- `deploy/asterisk/pjsip.conf`

Then apply the server-side setup:

```bash
sudo ./scripts/install-system.sh
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
sudo ./scripts/install-systemd-service.sh
```

For production-like validation and operational procedures, use the runbooks in [`docs/`](docs).

## System Deployment

ChatCatHat is deployed as a single-host, non-Docker Linux system. The default repository layout and service scripts assume an Ubuntu-style environment with the project checked out at `/home/ubuntu/fyp/PrivacyCalling`.

### Deployment model

- `asterisk` runs as the SIP, RTP, and bridging layer
- `privacy-calling-api` runs as the Node.js control-plane service under `systemd`
- `SQLite` stores local state in `data/privacy.db`
- Asterisk config is copied into `/etc/asterisk`
- The API service unit is installed at `/etc/systemd/system/privacy-calling-api.service`

### Important deployment files

- Environment file: `deploy/env/privacy-calling.env`
- Asterisk templates: `deploy/asterisk/*.conf`
- API service unit: `deploy/systemd/privacy-calling-api.service`
- Database path default: `data/privacy.db`

Note: the bundled systemd unit currently hardcodes `User=ubuntu` and `WorkingDirectory=/home/ubuntu/fyp/PrivacyCalling`. If your server layout is different, update [`deploy/systemd/privacy-calling-api.service`](deploy/systemd/privacy-calling-api.service) before installing it.

### Deployment steps

1. Install system packages required by the telephony stack:

```bash
sudo ./scripts/install-system.sh
```

2. Install Node.js dependencies:

```bash
npm install
```

3. Create and edit the runtime environment file:

```bash
cp deploy/env/privacy-calling.env.example deploy/env/privacy-calling.env
```

Set at least:

- `API_KEY`
- `ASTERISK_AMI_SECRET`
- `APP_HOST` / `APP_PORT` if you do not want the defaults
- optional `AUTH_*`, `CHAIN_*`, and `LLM_*` values depending on your deployment mode

4. Review and adjust Asterisk-side configuration:

- set the correct public IP in `deploy/asterisk/pjsip.conf`
- verify endpoint credentials for demo users such as `alice`, `bob`, and `charlie`
- fill in trunk credentials if outbound carrier routing is needed

5. Initialize the database and demo records:

```bash
npm run db:init
npm run db:seed
```

6. Deploy Asterisk configuration and sync the runtime mapping database:

```bash
sudo ./scripts/deploy-asterisk-config.sh
sudo ./scripts/sync-asterisk-astdb.sh
```

7. Install and start the API service:

```bash
sudo ./scripts/install-systemd-service.sh
```

### Verification

After deployment, verify both services and the API health endpoint:

```bash
sudo systemctl status asterisk privacy-calling-api --no-pager
curl -sS http://127.0.0.1:8080/health
sudo asterisk -rx 'pjsip show endpoints'
```

Expected result:

- `asterisk` and `privacy-calling-api` are both `active (running)`
- `/health` returns `status: ok`
- demo SIP endpoints appear in the Asterisk endpoint list

## API Snapshot

### Create a privacy call

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

### Check service health

```bash
curl 'http://127.0.0.1:8080/health'
```

### Inspect operations overview

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/ops/overview'
```

### Query capacity models

```bash
curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/capacity/engset?N=200&C=60&beta=0.08'

curl -H 'x-api-key: change-me-api-key' \
  'http://127.0.0.1:8080/v1/capacity/privacy-exhaustion?N=1000&p=0.02&M=30'
```

## AI Diagnostics

ChatCatHat can attach an OpenAI-compatible LLM to the ops dashboard so operators can summarize alerts, recent logs, and service state from a single action.

Example configuration:

```env
LLM_ENABLED=true
LLM_PROVIDER=openai-compatible
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4.1-mini
LLM_TIMEOUT_MS=30000
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=1600
```

The diagnostics flow redacts sensitive fields such as API keys, JWT-like tokens, phone numbers, and message content before sending context to the model.

## Docs

- [Operations Runbook (EN)](docs/Runbook.md)
- [Operations Runbook (中文)](docs/Runbook.zh-CN.md)
- [Problem Statement](<docs/Problem Statement New.md>)
- [Android SIP Client README](client/android-sip-client/README.md)

## Repository Layout

```text
.
├── client/android-sip-client/   # Kotlin + Linphone Android SIP client
├── data/                        # generated benchmark data and local SQLite db path
├── deploy/asterisk/             # Asterisk config templates
├── deploy/systemd/              # systemd unit files
├── docs/                        # runbooks and project documents
├── scripts/                     # provisioning, install, deploy, and benchmark tools
├── src/                         # API, auth, services, dashboard, db layer
└── test/                        # node:test coverage
```

## Roadmap

- Add TLS/SRTP hardening for transport and media
- Expand WebRTC gateway support beyond the current SIP-first flow
- Improve multi-tenant and production-grade authentication paths
- Persist richer messaging history for clients beyond the current MVP scope
- Add more benchmark presets and visualization assets for acceptance demos

## License

MIT, as declared in [`package.json`](package.json).
