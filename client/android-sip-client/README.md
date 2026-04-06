# Android SIP Client (MVP)

Kotlin + Linphone Android SIP client for the PrivacyCalling server.

## Features (MVP)

- SIP account login/registration (`UDP`, default port `5160`)
- Call flow: dial, incoming call prompt, accept, reject, hangup
- SIP MESSAGE flow: send/receive `text/plain` messages
- Client-side message validation: `1..1024` bytes
- In-app recent message list with status (`sending/sent/failed/received`)

## SIP Field Mapping

- Username: Asterisk endpoint (for example `alice` / `bob` / `charlie`)
- Domain: server IP (no port)
- Proxy/Server: `IP:5160`
- Transport: `UDP`

## Build

```bash
cd /home/ubuntu/fyp/PrivacyCalling/client/android-sip-client
./gradlew assembleDebug
```

Expected APK path:

`app/build/outputs/apk/debug/app-debug.apk`

## Install

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Quick Validation

1. Login as `alice` on device A and `bob` on device B.
2. From A, call `bob` or `+8613900000002`.
3. From A, send SIP MESSAGE to `bob`; verify delivery on B.
4. Test offline failure by logging out B; send again and verify failed status.

## Known MVP Limits

- Single-account foreground app model
- No background push wake-up service
- No local message persistence (memory list only)
- No API Key/JWT/blockchain auth integration
- No PSTN/SMS integration; message means SIP MESSAGE only
