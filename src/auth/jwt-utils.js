const crypto = require('crypto');
const { AuthError } = require('../utils/errors');

function base64urlEncode(bufferOrString) {
  const raw = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(String(bufferOrString), 'utf8');

  return raw
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecodeToString(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : `${normalized}${'='.repeat(4 - pad)}`;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signHmacSha256(data, secret) {
  return crypto
    .createHmac('sha256', String(secret || ''))
    .update(String(data || ''))
    .digest();
}

function createJwt({ payload, secret, expiresSec = 300 }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const safeExpires = Math.max(30, Number.parseInt(expiresSec, 10) || 300);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const claims = {
    ...payload,
    iat: nowSec,
    exp: nowSec + safeExpires
  };

  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64urlEncode(signHmacSha256(signingInput, secret));

  return {
    token: `${signingInput}.${signature}`,
    claims,
    expires_in_sec: safeExpires
  };
}

function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new AuthError('Invalid bearer token format');
  }

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSig = base64urlEncode(signHmacSha256(signingInput, secret));
  const expectedBuf = Buffer.from(expectedSig);
  const gotBuf = Buffer.from(encodedSig);

  if (expectedBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expectedBuf, gotBuf)) {
    throw new AuthError('Invalid bearer token signature');
  }

  let claims;
  try {
    claims = JSON.parse(base64urlDecodeToString(encodedPayload));
  } catch (error) {
    throw new AuthError('Invalid bearer token payload');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) < nowSec) {
    throw new AuthError('Bearer token expired');
  }

  return claims;
}

module.exports = {
  createJwt,
  verifyJwt
};
