const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { ApiKeyAuthProvider } = require('../src/auth/api-key-auth-provider');
const { AppError } = require('../src/utils/errors');

function createDeps() {
  const auditStore = [];

  const db = {
    healthCheck() {
      return { ok: 1 };
    },
    getDashboardSummary() {
      return {
        calls: { total: 0, active: 0, completed: 0, failed: 0, last_24h: 0, failed_last_24h: 0 },
        users: { total: 0, enabled: 0 },
        virtual_numbers: { total: 0, enabled: 0 }
      };
    },
    getRecentCalls() {
      return [];
    },
    addOpsAuditEvent(payload) {
      auditStore.unshift({
        id: auditStore.length + 1,
        created_at: new Date().toISOString(),
        ...payload
      });
    },
    listOpsAuditEvents(limit) {
      return auditStore.slice(0, limit);
    }
  };

  const opsManager = {
    listManagedServices() {
      return ['asterisk', 'privacy-calling-api'];
    },
    async getServicesStatus() {
      return [
        {
          id: 'asterisk',
          description: 'Asterisk PBX',
          load_state: 'loaded',
          active_state: 'active',
          sub_state: 'running',
          unit_file_state: 'enabled',
          main_pid: 123,
          fragment_path: '/lib/systemd/system/asterisk.service',
          active_since: 'now'
        }
      ];
    },
    async controlService(service, action) {
      if (action === 'restart') {
        return {
          id: service,
          active_state: 'active',
          sub_state: 'running',
          load_state: 'loaded',
          unit_file_state: 'enabled',
          main_pid: 111,
          fragment_path: '',
          active_since: 'now'
        };
      }
      throw new AppError('forbidden', 403, 'service_control_forbidden');
    }
  };

  const deps = {
    authProvider: new ApiKeyAuthProvider('k'),
    callService: {
      getCall() {
        return { call_id: 'x' };
      },
      createCall() {
        return { call_id: 'x', selected_virtual_id: '+1', status: 'originating' };
      }
    },
    db,
    amiClient: {
      status() {
        return { connected: true, authenticated: true };
      }
    },
    opsManager,
    opsLogService: {
      listManagedServices() {
        return ['asterisk', 'privacy-calling-api'];
      },
      async getLogs(query) {
        return {
          entries: [
            {
              timestamp: new Date().toISOString(),
              service: 'asterisk',
              level: 'warning',
              message: 'sample',
              cursor: 'x'
            }
          ],
          warnings: [],
          query
        };
      }
    },
    config: {
      ops: {
        dashboardEnabled: true,
        allowServiceControl: true,
        alerts: {
          loadPerCpu: { warn: 0.8, error: 1.2 },
          heapUsage: { warn: 0.75, error: 0.9 },
          activeCalls: { warn: 30, error: 50 }
        }
      }
    }
  };

  return {
    app: createApp(deps),
    auditStore
  };
}

function getRouteHandler(app, method, path) {
  const layer = app.router.stack.find((item) => {
    return item.route && item.route.path === path && item.route.methods[method];
  });

  if (!layer || !layer.route || !layer.route.stack || !layer.route.stack[0]) {
    throw new Error(`route handler not found for ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[0].handle;
}

function invokeHandler(handler, reqInput) {
  return new Promise((resolve, reject) => {
    const req = {
      query: {},
      params: {},
      body: {},
      principal: { id: 'static-api-key' },
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

test('ops audit routes support write/read and whitelist checks', async () => {
  const { app } = createDeps();
  const writeHandler = getRouteHandler(app, 'post', '/v1/ops/audit-events');
  const readHandler = getRouteHandler(app, 'get', '/v1/ops/audit-events');

  const writeResult = await invokeHandler(writeHandler, {
    body: {
      action: 'logs_manual_refresh',
      target: 'dashboard.logs',
      result: 'success',
      details: { source: 'test' }
    }
  });

  assert.equal(writeResult.status, 201);

  const readResult = await invokeHandler(readHandler, {
    query: { limit: '10' }
  });

  assert.equal(readResult.status, 200);
  assert.equal(readResult.payload.events.length, 1);
  assert.equal(readResult.payload.events[0].action, 'logs_manual_refresh');

  await assert.rejects(
    () =>
      invokeHandler(writeHandler, {
        body: {
          action: 'not_allowed'
        }
      }),
    (error) => error && error.code === 'unsupported_audit_action'
  );
});

test('ops service control route writes success and failed audit records', async () => {
  const { app, auditStore } = createDeps();
  const serviceHandler = getRouteHandler(app, 'post', '/v1/ops/services/:service/:action');

  const okResult = await invokeHandler(serviceHandler, {
    params: {
      service: 'asterisk',
      action: 'restart'
    }
  });

  assert.equal(okResult.status, 200);

  await assert.rejects(
    () =>
      invokeHandler(serviceHandler, {
        params: {
          service: 'asterisk',
          action: 'stop'
        }
      }),
    (error) => error && error.code === 'service_control_forbidden'
  );

  assert.equal(auditStore.length, 2);
  assert.equal(auditStore[1].action, 'service_restart');
  assert.equal(auditStore[1].result, 'success');
  assert.equal(auditStore[0].action, 'service_stop');
  assert.equal(auditStore[0].result, 'failed');
});

test('ops logs route returns payload from log service', async () => {
  const { app } = createDeps();
  const logsHandler = getRouteHandler(app, 'get', '/v1/ops/logs');

  const result = await invokeHandler(logsHandler, {
    query: {
      services: 'asterisk',
      levels: 'warning',
      limit: '20',
      since_sec: '300'
    }
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.entries.length, 1);
  assert.equal(result.payload.entries[0].level, 'warning');
  assert.equal(result.payload.query.services, 'asterisk');
});
