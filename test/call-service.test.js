const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseService } = require('../src/db');
const { ConsistentCalleePolicy } = require('../src/policy/consistent-callee-policy');
const { CallStateMachine } = require('../src/services/call-state-machine');
const { CallService } = require('../src/services/call-service');

function createFixtureDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-call-svc-'));
  const dbPath = path.join(tempDir, 'test.db');
  const db = new DatabaseService(dbPath);

  db.db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES
      ('caller-alice', 'Alice', '+8613900000001', 'alice', 1, datetime('now'), datetime('now')),
      ('callee-bob', 'Bob', '+8613900000002', 'bob', 1, datetime('now'), datetime('now'))
  `).run();

  db.db.prepare(`
    INSERT INTO virtual_numbers (e164, enabled, created_at, updated_at)
    VALUES ('+8613800011111', 1, datetime('now'), datetime('now'))
  `).run();

  return { db, tempDir };
}

test('CallService creates callback style call for local SIP callee', async () => {
  const { db, tempDir } = createFixtureDb();
  const sm = new CallStateMachine(db);

  const sentActions = [];
  const amiClient = {
    status() {
      return { connected: true, authenticated: true };
    },
    async sendAction(action) {
      sentActions.push(action);
      return { Response: 'Success' };
    }
  };

  const service = new CallService({
    db,
    amiClient,
    identityPolicy: new ConsistentCalleePolicy(db),
    callStateMachine: sm,
    config: {
      call: { timeoutSecDefault: 30, timeoutSecMax: 120 },
      asterisk: { context: 'privacy_bridge', exten: 's', priority: 1 }
    }
  });

  const result = await service.createCall({
    callerUserId: 'caller-alice',
    calleeE164: '+8613900000002',
    timeoutSec: 20,
    requestedBy: 'test'
  });

  assert.equal(result.status, 'originating');
  assert.equal(sentActions.length, 1);

  const persisted = db.getCallWithLegs(result.call_id);
  assert.equal(persisted.callee_e164, '+8613900000002');
  assert.equal(persisted.selected_virtual_id, '+8613800011111');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
