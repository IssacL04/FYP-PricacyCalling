const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseService } = require('../src/db');

function createFixtureDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-call-audit-'));
  const dbPath = path.join(tempDir, 'test.db');
  const db = new DatabaseService(dbPath);
  return { db, tempDir };
}

test('DatabaseService persists and reads ops audit events', () => {
  const { db, tempDir } = createFixtureDb();

  db.addOpsAuditEvent({
    actor: 'tester',
    action: 'logs_manual_refresh',
    target: 'dashboard.logs',
    result: 'success',
    details: { from: 'unit-test' }
  });

  db.addOpsAuditEvent({
    actor: 'tester',
    action: 'service_restart',
    target: 'asterisk',
    result: 'failed',
    details: { code: 'service_control_forbidden' }
  });

  const events = db.listOpsAuditEvents(10);
  assert.equal(events.length, 2);
  assert.equal(events[0].action, 'service_restart');
  assert.equal(events[1].action, 'logs_manual_refresh');
  assert.equal(events[1].details.from, 'unit-test');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('DatabaseService audit migration is idempotent', () => {
  const { db, tempDir } = createFixtureDb();

  db.migrate();
  db.addOpsAuditEvent({
    actor: 'tester',
    action: 'logs_export_json',
    target: 'dashboard.logs',
    result: 'success',
    details: null
  });

  const events = db.listOpsAuditEvents(1);
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'logs_export_json');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
