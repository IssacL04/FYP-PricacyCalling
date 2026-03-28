const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { ApiKeyAuthProvider } = require('../src/auth/api-key-auth-provider');

function createDeps(blockchainAuthService, options = {}) {
  const authConfig = options.auth || {};
  return {
    authProvider: new ApiKeyAuthProvider('k'),
    blockchainAuthService,
    callService: {
      getCall() {
        return { call_id: 'x' };
      },
      createCall() {
        return { call_id: 'x', selected_virtual_id: '+1', status: 'originating' };
      }
    },
    db: {
      healthCheck() {
        return { ok: 1 };
      }
    },
    amiClient: {
      status() {
        return { connected: true, authenticated: true };
      }
    },
    config: {
      auth: {
        demoMode: Boolean(authConfig.demoMode),
        demoAddress: authConfig.demoAddress || '0x1111111111111111111111111111111111111111',
        demoNodeId: authConfig.demoNodeId || 'demo-node'
      },
      ops: {
        dashboardEnabled: true
      }
    }
  };
}

function getRouteHandler(app, method, routePath) {
  const layer = app.router.stack.find((item) => {
    return item.route && item.route.path === routePath && item.route.methods[method];
  });

  if (!layer || !layer.route || !layer.route.stack || !layer.route.stack[0]) {
    throw new Error(`route handler not found for ${method.toUpperCase()} ${routePath}`);
  }

  return layer.route.stack[0].handle;
}

function invokeHandler(handler, reqInput) {
  return new Promise((resolve, reject) => {
    const req = {
      query: {},
      params: {},
      body: {},
      ...reqInput
    };

    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.headersSent = true;
        resolve({
          status: this.statusCode,
          payload
        });
      }
    };

    const next = (error) => {
      if (error) {
        reject(error);
      }
    };

    Promise.resolve(handler(req, res, next)).catch(reject);
  });
}

test('GET /v1/auth/challenge returns challenge payload', async () => {
  const service = {
    createChallenge({ address, nodeId }) {
      assert.equal(address, '0x1111111111111111111111111111111111111111');
      assert.equal(nodeId, 'node-a');
      return {
        challenge_id: 'cid-1',
        message: 'challenge-message',
        expires_in_sec: 60
      };
    }
  };

  const app = createApp(createDeps(service));
  const handler = getRouteHandler(app, 'get', '/v1/auth/challenge');

  const result = await invokeHandler(handler, {
    query: {
      address: '0x1111111111111111111111111111111111111111',
      node_id: 'node-a'
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.status, 'ok');
  assert.equal(result.payload.challenge_id, 'cid-1');
});

test('GET /v1/auth/challenge returns 404 when blockchain auth is disabled', async () => {
  const app = createApp(createDeps(null));
  const handler = getRouteHandler(app, 'get', '/v1/auth/challenge');

  await assert.rejects(
    () =>
      invokeHandler(handler, {
        query: {
          address: '0x1111111111111111111111111111111111111111'
        }
      }),
    (error) => error && error.code === 'blockchain_auth_disabled'
  );
});

test('POST /v1/auth/verify returns jwt payload', async () => {
  const service = {
    async verifyChallenge({ address, nodeId, challengeId, signature }) {
      assert.equal(address, '0x1111111111111111111111111111111111111111');
      assert.equal(nodeId, 'node-a');
      assert.equal(challengeId, 'cid-1');
      assert.equal(signature, '0xdeadbeef');
      return {
        access_token: 'jwt-1',
        token_type: 'Bearer',
        expires_in_sec: 300,
        subject_address: '0x1111111111111111111111111111111111111111',
        node_id: 'node-a',
        auth_method: 'blockchain'
      };
    }
  };

  const app = createApp(createDeps(service));
  const handler = getRouteHandler(app, 'post', '/v1/auth/verify');

  const result = await invokeHandler(handler, {
    body: {
      address: '0x1111111111111111111111111111111111111111',
      node_id: 'node-a',
      challenge_id: 'cid-1',
      signature: '0xdeadbeef'
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.status, 'ok');
  assert.equal(result.payload.token_type, 'Bearer');
  assert.equal(result.payload.auth_method, 'blockchain');
});

test('POST /v1/auth/verify returns 404 when blockchain auth is disabled', async () => {
  const app = createApp(createDeps(null));
  const handler = getRouteHandler(app, 'post', '/v1/auth/verify');

  await assert.rejects(
    () =>
      invokeHandler(handler, {
        body: {
          address: '0x1111111111111111111111111111111111111111',
          challenge_id: 'cid-1',
          signature: '0xdeadbeef'
        }
      }),
    (error) => error && error.code === 'blockchain_auth_disabled'
  );
});

test('POST /v1/auth/demo-login returns token when demo mode is enabled', async () => {
  const service = {
    createDemoSession({ address, nodeId }) {
      assert.equal(address, '0x1111111111111111111111111111111111111111');
      assert.equal(nodeId, 'demo-node');
      return {
        access_token: 'demo-jwt',
        token_type: 'Bearer',
        expires_in_sec: 300,
        subject_address: address,
        node_id: nodeId,
        auth_method: 'blockchain_demo'
      };
    }
  };

  const app = createApp(createDeps(service, {
    auth: {
      demoMode: true
    }
  }));
  const handler = getRouteHandler(app, 'post', '/v1/auth/demo-login');

  const result = await invokeHandler(handler, {
    body: {}
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.status, 'ok');
  assert.equal(result.payload.demo_mode, true);
  assert.equal(result.payload.auth_method, 'blockchain_demo');
});

test('POST /v1/auth/demo-login returns 404 when demo mode is disabled', async () => {
  const app = createApp(createDeps({}, {
    auth: {
      demoMode: false
    }
  }));
  const handler = getRouteHandler(app, 'post', '/v1/auth/demo-login');

  await assert.rejects(
    () => invokeHandler(handler, { body: {} }),
    (error) => error && error.code === 'auth_demo_disabled'
  );
});

test('POST /v1/auth/demo-login rejects when auth mode cannot issue jwt', async () => {
  const app = createApp(createDeps(null, {
    auth: {
      demoMode: true
    }
  }));
  const handler = getRouteHandler(app, 'post', '/v1/auth/demo-login');

  await assert.rejects(
    () => invokeHandler(handler, { body: {} }),
    (error) => error && error.code === 'auth_mode_not_supported'
  );
});
