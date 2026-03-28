const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiKeyAuthProvider } = require('../src/auth/api-key-auth-provider');
const { JwtAuthProvider } = require('../src/auth/jwt-auth-provider');
const { HybridAuthProvider } = require('../src/auth/hybrid-auth-provider');
const { createJwt } = require('../src/auth/jwt-utils');

test('ApiKeyAuthProvider accepts valid key', () => {
  const provider = new ApiKeyAuthProvider('good-key');
  const principal = provider.authenticate({
    header(name) {
      return name === 'x-api-key' ? 'good-key' : undefined;
    }
  });

  assert.equal(principal.type, 'api_key');
});

test('ApiKeyAuthProvider rejects invalid key', () => {
  const provider = new ApiKeyAuthProvider('good-key');
  assert.throws(
    () =>
      provider.authenticate({
        header() {
          return 'bad-key';
        }
      }),
    /Invalid API key/
  );
});

test('JwtAuthProvider accepts valid bearer token', () => {
  const token = createJwt({
    payload: {
      sub: '0x1111111111111111111111111111111111111111',
      node_id: 'node-01',
      auth_method: 'blockchain'
    },
    secret: 'jwt-secret'
  });

  const provider = new JwtAuthProvider('jwt-secret');
  const principal = provider.authenticate({
    header(name) {
      if (name.toLowerCase() === 'authorization') {
        return `Bearer ${token.token}`;
      }
      return undefined;
    }
  });

  assert.equal(principal.type, 'bearer_jwt');
  assert.equal(principal.id, '0x1111111111111111111111111111111111111111');
  assert.equal(principal.node_id, 'node-01');
});

test('JwtAuthProvider rejects when bearer is missing', () => {
  const provider = new JwtAuthProvider('jwt-secret');
  assert.throws(
    () =>
      provider.authenticate({
        header() {
          return undefined;
        }
      }),
    /Missing bearer token/
  );
});

test('HybridAuthProvider falls back to api key when bearer token is absent', () => {
  const hybrid = new HybridAuthProvider({
    jwtProvider: new JwtAuthProvider('jwt-secret'),
    apiKeyProvider: new ApiKeyAuthProvider('good-key'),
    enableApiKeyFallback: true
  });

  const principal = hybrid.authenticate({
    header(name) {
      return name === 'x-api-key' ? 'good-key' : undefined;
    }
  });

  assert.equal(principal.type, 'api_key');
});

test('HybridAuthProvider prefers bearer token and does not silently fall back', () => {
  const token = createJwt({
    payload: {
      sub: '0x1111111111111111111111111111111111111111'
    },
    secret: 'jwt-secret'
  });

  const hybrid = new HybridAuthProvider({
    jwtProvider: new JwtAuthProvider('jwt-secret'),
    apiKeyProvider: new ApiKeyAuthProvider('good-key'),
    enableApiKeyFallback: true
  });

  const principal = hybrid.authenticate({
    header(name) {
      if (name.toLowerCase() === 'authorization') {
        return `Bearer ${token.token}`;
      }
      if (name.toLowerCase() === 'x-api-key') {
        return 'bad-key';
      }
      return undefined;
    }
  });

  assert.equal(principal.type, 'bearer_jwt');
});

test('HybridAuthProvider rejects when fallback is disabled and bearer is absent', () => {
  const hybrid = new HybridAuthProvider({
    jwtProvider: new JwtAuthProvider('jwt-secret'),
    apiKeyProvider: new ApiKeyAuthProvider('good-key'),
    enableApiKeyFallback: false
  });

  assert.throws(
    () =>
      hybrid.authenticate({
        header() {
          return undefined;
        }
      }),
    /Authentication required/
  );
});
