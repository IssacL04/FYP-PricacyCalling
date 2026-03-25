const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiKeyAuthProvider } = require('../src/auth/api-key-auth-provider');

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
