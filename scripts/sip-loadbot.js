const dgram = require('dgram');
const crypto = require('crypto');

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
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildHeaderMap(lines) {
  const headers = new Map();
  lines.forEach((line) => {
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
  return headers;
}

function parseSipMessage(buffer) {
  const raw = buffer.toString('utf8');
  const splitIndex = raw.indexOf('\r\n\r\n') >= 0
    ? raw.indexOf('\r\n\r\n')
    : raw.indexOf('\n\n');
  const head = splitIndex >= 0 ? raw.slice(0, splitIndex) : raw;
  const body = splitIndex >= 0 ? raw.slice(splitIndex + (raw.indexOf('\r\n\r\n') >= 0 ? 4 : 2)) : '';

  const lines = head
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const startLine = lines[0];
  const headers = buildHeaderMap(lines.slice(1));
  const isResponse = startLine.startsWith('SIP/2.0');
  let method = '';
  let requestUri = '';
  let statusCode = 0;
  let reasonPhrase = '';

  if (isResponse) {
    const parts = startLine.split(/\s+/);
    statusCode = Number.parseInt(parts[1], 10) || 0;
    reasonPhrase = parts.slice(2).join(' ');
  } else {
    const parts = startLine.split(/\s+/);
    method = (parts[0] || '').toUpperCase();
    requestUri = parts[1] || '';
  }

  return {
    raw,
    startLine,
    isResponse,
    method,
    requestUri,
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

function getHeaders(message, name) {
  const values = message.headers.get(String(name || '').toLowerCase());
  return values ? [...values] : [];
}

function withTag(headerValue, tag) {
  const hasTag = /;\s*tag=/i.test(headerValue);
  if (hasTag) {
    return headerValue;
  }
  return `${headerValue};tag=${tag}`;
}

function parseCSeqNumber(cseqHeader) {
  const first = String(cseqHeader || '').split(/\s+/, 1)[0];
  const parsed = Number.parseInt(first, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function contentLength(body) {
  return Buffer.byteLength(body || '', 'utf8');
}

function buildResponse({
  statusCode,
  reasonPhrase,
  viaHeaders,
  fromHeader,
  toHeader,
  callId,
  cseq,
  contact,
  body,
  extraHeaders = []
}) {
  const lines = [];
  lines.push(`SIP/2.0 ${statusCode} ${reasonPhrase}`);
  viaHeaders.forEach((via) => lines.push(`Via: ${via}`));
  lines.push(`From: ${fromHeader}`);
  lines.push(`To: ${toHeader}`);
  lines.push(`Call-ID: ${callId}`);
  lines.push(`CSeq: ${cseq}`);
  if (contact) {
    lines.push(`Contact: ${contact}`);
  }
  extraHeaders.forEach((h) => lines.push(h));
  lines.push(`Content-Length: ${contentLength(body)}`);
  lines.push('');
  lines.push(body || '');
  return lines.join('\r\n');
}

function buildRequest({
  method,
  uri,
  via,
  from,
  to,
  callId,
  cseqNumber,
  contact,
  body = ''
}) {
  const lines = [];
  lines.push(`${method} ${uri} SIP/2.0`);
  lines.push(`Via: ${via}`);
  lines.push('Max-Forwards: 70');
  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  lines.push(`Call-ID: ${callId}`);
  lines.push(`CSeq: ${cseqNumber} ${method}`);
  lines.push(`Contact: ${contact}`);
  lines.push('User-Agent: privacy-calling-loadbot');
  lines.push(`Content-Length: ${contentLength(body)}`);
  lines.push('');
  lines.push(body);
  return lines.join('\r\n');
}

function randomId(len = 8) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

function buildSdp({ address, rtpPort }) {
  return [
    'v=0',
    `o=- 0 0 IN IP4 ${address}`,
    's=PrivacyLoadbot',
    `c=IN IP4 ${address}`,
    't=0 0',
    `m=audio ${rtpPort} RTP/AVP 0 101`,
    'a=rtpmap:0 PCMU/8000',
    'a=rtpmap:101 telephone-event/8000',
    'a=fmtp:101 0-16',
    'a=sendrecv'
  ].join('\r\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bindHost = String(args.host || '0.0.0.0');
  const bindPort = Math.max(1, toInt(args.port, 17060));
  const publicHost = String(args['public-host'] || '127.0.0.1');
  const autoByeMs = Math.max(0, toInt(args['auto-bye-ms'], 1500));
  const rtpPortBase = Math.max(10000, toInt(args['rtp-port-base'], 30000));

  const socket = dgram.createSocket('udp4');
  const dialogs = new Map();
  let inviteCount = 0;
  let activeCalls = 0;

  function send(message, targetPort, targetHost) {
    const payload = Buffer.from(message, 'utf8');
    socket.send(payload, targetPort, targetHost);
  }

  function handleInvite(message, rinfo) {
    inviteCount += 1;
    activeCalls += 1;

    const viaHeaders = getHeaders(message, 'via');
    const fromHeader = getHeader(message, 'from');
    const toHeader = getHeader(message, 'to');
    const callId = getHeader(message, 'call-id');
    const cseq = getHeader(message, 'cseq');
    const requestUri = message.requestUri || `sip:${publicHost}:${bindPort}`;
    const localTag = randomId(10);

    const toWithTag = withTag(toHeader, localTag);
    const contact = `<sip:loadbot@${publicHost}:${bindPort};transport=udp>`;

    const trying = buildResponse({
      statusCode: 100,
      reasonPhrase: 'Trying',
      viaHeaders,
      fromHeader,
      toHeader: toWithTag,
      callId,
      cseq,
      contact,
      body: ''
    });
    send(trying, rinfo.port, rinfo.address);

    const ringing = buildResponse({
      statusCode: 180,
      reasonPhrase: 'Ringing',
      viaHeaders,
      fromHeader,
      toHeader: toWithTag,
      callId,
      cseq,
      contact,
      body: ''
    });
    send(ringing, rinfo.port, rinfo.address);

    const sdp = buildSdp({
      address: publicHost,
      rtpPort: rtpPortBase + (inviteCount % 1000)
    });
    const ok = buildResponse({
      statusCode: 200,
      reasonPhrase: 'OK',
      viaHeaders,
      fromHeader,
      toHeader: toWithTag,
      callId,
      cseq,
      contact,
      body: sdp,
      extraHeaders: [
        'Content-Type: application/sdp',
        'Allow: INVITE, ACK, BYE, CANCEL, OPTIONS'
      ]
    });
    send(ok, rinfo.port, rinfo.address);

    const dialog = {
      callId,
      fromHeader,
      toHeader,
      toWithTag,
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
      requestUri,
      byeCSeq: parseCSeqNumber(cseq) + 1,
      ended: false
    };
    dialogs.set(callId, dialog);

    if (autoByeMs > 0) {
      setTimeout(() => {
        const current = dialogs.get(callId);
        if (!current || current.ended) {
          return;
        }

        const via = `SIP/2.0/UDP ${publicHost}:${bindPort};branch=z9hG4bK${randomId(10)}`;
        const bye = buildRequest({
          method: 'BYE',
          uri: current.requestUri,
          via,
          from: current.toWithTag,
          to: current.fromHeader,
          callId: current.callId,
          cseqNumber: current.byeCSeq,
          contact
        });
        send(bye, current.remotePort, current.remoteAddress);
      }, autoByeMs);
    }
  }

  function handleBye(message, rinfo) {
    const viaHeaders = getHeaders(message, 'via');
    const fromHeader = getHeader(message, 'from');
    const toHeader = getHeader(message, 'to');
    const callId = getHeader(message, 'call-id');
    const cseq = getHeader(message, 'cseq');
    const contact = `<sip:loadbot@${publicHost}:${bindPort};transport=udp>`;

    const ok = buildResponse({
      statusCode: 200,
      reasonPhrase: 'OK',
      viaHeaders,
      fromHeader,
      toHeader,
      callId,
      cseq,
      contact,
      body: ''
    });
    send(ok, rinfo.port, rinfo.address);

    const existing = dialogs.get(callId);
    if (existing && !existing.ended) {
      existing.ended = true;
      activeCalls = Math.max(0, activeCalls - 1);
      dialogs.delete(callId);
    }
  }

  function handleOptions(message, rinfo) {
    const viaHeaders = getHeaders(message, 'via');
    const fromHeader = getHeader(message, 'from');
    const toHeader = getHeader(message, 'to');
    const callId = getHeader(message, 'call-id');
    const cseq = getHeader(message, 'cseq');
    const contact = `<sip:loadbot@${publicHost}:${bindPort};transport=udp>`;

    const ok = buildResponse({
      statusCode: 200,
      reasonPhrase: 'OK',
      viaHeaders,
      fromHeader,
      toHeader: withTag(toHeader, randomId(8)),
      callId,
      cseq,
      contact,
      body: '',
      extraHeaders: [
        'Allow: INVITE, ACK, BYE, CANCEL, OPTIONS'
      ]
    });
    send(ok, rinfo.port, rinfo.address);
  }

  socket.on('message', (buffer, rinfo) => {
    const message = parseSipMessage(buffer);
    if (!message) {
      return;
    }

    if (message.isResponse) {
      const cseq = getHeader(message, 'cseq').toUpperCase();
      if (message.statusCode >= 200 && cseq.includes('BYE')) {
        const callId = getHeader(message, 'call-id');
        const existing = dialogs.get(callId);
        if (existing && !existing.ended) {
          existing.ended = true;
          activeCalls = Math.max(0, activeCalls - 1);
          dialogs.delete(callId);
        }
      }
      return;
    }

    if (message.method === 'INVITE') {
      handleInvite(message, rinfo);
      return;
    }

    if (message.method === 'BYE') {
      handleBye(message, rinfo);
      return;
    }

    if (message.method === 'OPTIONS') {
      handleOptions(message, rinfo);
      return;
    }

    if (message.method === 'ACK') {
      return;
    }

    if (message.method === 'CANCEL') {
      const viaHeaders = getHeaders(message, 'via');
      const fromHeader = getHeader(message, 'from');
      const toHeader = getHeader(message, 'to');
      const callId = getHeader(message, 'call-id');
      const cseq = getHeader(message, 'cseq');
      const response = buildResponse({
        statusCode: 200,
        reasonPhrase: 'OK',
        viaHeaders,
        fromHeader,
        toHeader,
        callId,
        cseq,
        contact: `<sip:loadbot@${publicHost}:${bindPort};transport=udp>`,
        body: ''
      });
      send(response, rinfo.port, rinfo.address);
    }
  });

  socket.on('listening', () => {
    const addr = socket.address();
    // eslint-disable-next-line no-console
    console.log(`SIP loadbot listening on ${addr.address}:${addr.port}`);
    // eslint-disable-next-line no-console
    console.log(`auto_bye_ms=${autoByeMs}`);
  });

  socket.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error(`SIP loadbot error: ${error.message}`);
  });

  const statsTimer = setInterval(() => {
    // eslint-disable-next-line no-console
    console.log(`stats: invites=${inviteCount}, active_dialogs=${activeCalls}`);
  }, 5000);

  function shutdown() {
    clearInterval(statsTimer);
    try {
      socket.close();
    } finally {
      process.exit(0);
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  socket.bind(bindPort, bindHost);
}

main();
