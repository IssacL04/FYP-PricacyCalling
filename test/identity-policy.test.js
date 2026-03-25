const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseService } = require('../src/db');
const { ConsistentCalleePolicy } = require('../src/policy/consistent-callee-policy');

function withDb(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-policy-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  const db = new DatabaseService(dbPath);

  db.db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES ('test-user', 'Test User', '+8613900009999', 'test-endpoint', 1, datetime('now'), datetime('now'))
  `).run();

  db.db.prepare(`
    INSERT INTO virtual_numbers (e164, enabled, created_at, updated_at)
    VALUES
      ('+8613800011111', 1, datetime('now'), datetime('now')),
      ('+8613800011112', 1, datetime('now'), datetime('now'))
  `).run();

  try {
    run(db);
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('consistent policy keeps same mapping for same callee', () => {
  withDb((db) => {
    const policy = new ConsistentCalleePolicy(db);
    const first = policy.selectVirtualIdentity({ calleeE164: '+8613900000002' });
    const second = policy.selectVirtualIdentity({ calleeE164: '+8613900000002' });
    assert.equal(first.id, second.id);
  });
});

test('consistent policy falls back when mapped number is busy', () => {
  withDb((db) => {
    const policy = new ConsistentCalleePolicy(db);
    const first = policy.selectVirtualIdentity({ calleeE164: '+8613900000003' });

    db.createCallWithLegs({
      call: {
        id: 'busy-call',
        caller_user_id: 'test-user',
        caller_real_e164: '+8613900009999',
        callee_e164: '+8613900000000',
        selected_virtual_number_id: first.id,
        selected_virtual_e164: first.e164,
        trunk_name: 'local',
        dial_target: 'PJSIP/none',
        action_id: null,
        status: 'bridged',
        bridge_status: 'bridged',
        failure_reason: null,
        requested_by: 'test',
        timeout_sec: 30,
        started_at: null,
        ended_at: null
      },
      aLeg: { channel: null, status: 'answered' },
      bLeg: { channel: null, status: 'answered' }
    });

    const second = policy.selectVirtualIdentity({ calleeE164: '+8613900000003' });
    assert.notEqual(second.id, first.id);
  });
});
