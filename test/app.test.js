const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { ApiKeyAuthProvider } = require('../src/auth/api-key-auth-provider');

test('createApp builds express app with route handlers', () => {
  const app = createApp({
    authProvider: new ApiKeyAuthProvider('k'),
    callService: {
      getCall() {
        return { call_id: 'x' };
      },
      createCall() {
        return { call_id: 'x', selected_virtual_id: '+1', status: 'originating' };
      }
    },
    db: { healthCheck: () => ({ ok: 1 }) },
    amiClient: { status: () => ({ connected: true, authenticated: true }) }
  });

  assert.equal(typeof app, 'function');
  assert.equal(typeof app.use, 'function');
  assert.equal(typeof app.get, 'function');
  assert.equal(typeof app.post, 'function');
});
