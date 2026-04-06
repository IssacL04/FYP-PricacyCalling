const crypto = require('crypto');
const dgram = require('dgram');

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function md5(value) {
  return crypto.createHash('md5').update(String(value), 'utf8').digest('hex');
}

function randomId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

function parseSipMessage(text) {
  const splitAt = text.indexOf('\r\n\r\n') >= 0 ? text.indexOf('\r\n\r\n') : text.indexOf('\n\n');
  const head = splitAt >= 0 ? text.slice(0, splitAt) : text;
  const body = splitAt >= 0 ? text.slice(splitAt + (text.includes('\r\n\r\n') ? 4 : 2)) : '';
  const lines = head.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const startLine = lines[0];
  const headers = new Map();
  lines.slice(1).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx <= 0) {
      return;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!headers.has(key)) {
      headers.set(key, []);
    }
    headers.get(key).push(value);
  });

  let statusCode = 0;
  let reasonPhrase = '';
  if (startLine.startsWith('SIP/2.0')) {
    const parts = startLine.split(/\s+/);
    statusCode = Number.parseInt(parts[1], 10) || 0;
    reasonPhrase = parts.slice(2).join(' ');
  }

  return {
    startLine,
    statusCode,
    reasonPhrase,
    headers,
    body
  };
}

function getHeader(message, name) {
  const values = message.headers.get(String(name || '').toLowerCase());
  if (!values || values.length === 0) {
    return '';
  }
  return values[0];
}

function parseDigestChallenge(value) {
  const raw = String(value || '').trim();
  const digestPrefix = /^Digest\s+/i;
  const payload = raw.replace(digestPrefix, '');
  const result = {};
  payload.split(',').forEach((chunk) => {
    const idx = chunk.indexOf('=');
    if (idx <= 0) {
      return;
    }
    const key = chunk.slice(0, idx).trim().toLowerCase();
    const valueRaw = chunk.slice(idx + 1).trim();
    const valueUnquoted = valueRaw.startsWith('"') && valueRaw.endsWith('"')
      ? valueRaw.slice(1, -1)
      : valueRaw;
    result[key] = valueUnquoted;
  });
  return result;
}

function buildAuthorization({
  username,
  password,
  realm,
  nonce,
  uri,
  method,
  qop
}) {
  const nc = '00000001';
  const cnonce = randomId(8);
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    'algorithm=MD5'
  ];
  if (qop) {
    parts.push(`qop=${qop}`);
    parts.push(`nc=${nc}`);
    parts.push(`cnonce="${cnonce}"`);
  }

  return `Digest ${parts.join(', ')}`;
}

function buildMessageRequest({
  fromUser,
  fromDomain,
  toUser,
  toDomain,
  serverHost,
  serverPort,
  callId,
  cseq,
  body,
  authorization
}) {
  const branch = `z9hG4bK${randomId(6)}`;
  const fromTag = randomId(6);
  const requestUri = `sip:${toUser}@${toDomain}`;
  const lines = [
    `MESSAGE ${requestUri} SIP/2.0`,
    `Via: SIP/2.0/UDP ${serverHost}:${serverPort};branch=${branch};rport`,
    'Max-Forwards: 70',
    `From: <sip:${fromUser}@${fromDomain}>;tag=${fromTag}`,
    `To: <sip:${toUser}@${toDomain}>`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} MESSAGE`,
    `Contact: <sip:${fromUser}@${fromDomain}>`,
    'User-Agent: privacy-calling-cli-probe',
    'Content-Type: text/plain'
  ];
  if (authorization) {
    lines.push(`Authorization: ${authorization}`);
  }
  lines.push(`Content-Length: ${Buffer.byteLength(body, 'utf8')}`);
  lines.push('');
  lines.push(body);
  return lines.join('\r\n');
}

function sendAndWait({
  socket,
  request,
  host,
  port,
  timeoutMs
}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('SIP response timeout'));
    }, timeoutMs);

    function onMessage(buffer) {
      clearTimeout(timer);
      socket.off('message', onMessage);
      const parsed = parseSipMessage(buffer.toString('utf8'));
      if (!parsed) {
        reject(new Error('failed to parse SIP response'));
        return;
      }
      resolve(parsed);
    }

    socket.on('message', onMessage);
    socket.send(Buffer.from(request, 'utf8'), port, host, (error) => {
      if (error) {
        clearTimeout(timer);
        socket.off('message', onMessage);
        reject(error);
      }
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const serverHost = String(args['server-host'] || '127.0.0.1');
  const serverPort = Math.max(1, toInt(args['server-port'], 5160));
  const fromUser = String(args['from-user'] || 'alice');
  const fromDomain = String(args['from-domain'] || serverHost);
  const toUser = String(args['to-user'] || 'bob');
  const toDomain = String(args['to-domain'] || serverHost);
  const password = String(args.password || `${fromUser}-strong-password`);
  const body = String(args.body || `CLI SIP MESSAGE probe ${Date.now()}`);
  const timeoutMs = Math.max(500, toInt(args['timeout-ms'], 5000));

  const socket = dgram.createSocket('udp4');
  const callId = `${randomId(8)}@${fromDomain}`;

  try {
    const request1 = buildMessageRequest({
      fromUser,
      fromDomain,
      toUser,
      toDomain,
      serverHost,
      serverPort,
      callId,
      cseq: 1,
      body,
      authorization: ''
    });

    const response1 = await sendAndWait({
      socket,
      request: request1,
      host: serverHost,
      port: serverPort,
      timeoutMs
    });

    if (response1.statusCode === 401 || response1.statusCode === 407) {
      const challengeHeader = response1.statusCode === 401
        ? getHeader(response1, 'www-authenticate')
        : getHeader(response1, 'proxy-authenticate');
      if (!challengeHeader) {
        throw new Error(`auth challenge missing (status=${response1.statusCode})`);
      }

      const challenge = parseDigestChallenge(challengeHeader);
      const qopRaw = String(challenge.qop || '').toLowerCase();
      const qop = qopRaw.includes('auth') ? 'auth' : '';
      const authValue = buildAuthorization({
        username: fromUser,
        password,
        realm: challenge.realm,
        nonce: challenge.nonce,
        uri: `sip:${toUser}@${toDomain}`,
        method: 'MESSAGE',
        qop
      });

      const request2 = buildMessageRequest({
        fromUser,
        fromDomain,
        toUser,
        toDomain,
        serverHost,
        serverPort,
        callId,
        cseq: 2,
        body,
        authorization: authValue
      });

      const response2 = await sendAndWait({
        socket,
        request: request2,
        host: serverHost,
        port: serverPort,
        timeoutMs
      });

      // eslint-disable-next-line no-console
      console.log(`final_status=${response2.statusCode} ${response2.reasonPhrase}`);
      process.exit(response2.statusCode >= 200 && response2.statusCode < 300 ? 0 : 1);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`final_status=${response1.statusCode} ${response1.reasonPhrase}`);
    process.exit(response1.statusCode >= 200 && response1.statusCode < 300 ? 0 : 1);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`probe_error=${error.message}`);
    process.exit(2);
  } finally {
    socket.close();
  }
}

main();
