const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseService } = require('../src/db');

function createFixtureDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-msg-db-'));
  const dbPath = path.join(tempDir, 'test.db');
  const db = new DatabaseService(dbPath);

  db.db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES ('caller-1', 'Caller One', '+8613900000001', 'alice', 1, datetime('now'), datetime('now'))
  `).run();

  return { db, tempDir };
}

test('DatabaseService upsertMessageEvent persists and updates message state', () => {
  const { db, tempDir } = createFixtureDb();

  db.upsertMessageEvent({
    id: 'msg-1',
    sender_user_id: 'caller-1',
    sender_endpoint: 'alice',
    sender_real_e164: '+8613900000001',
    target_endpoint: 'bob',
    target_e164: '+8613900000002',
    selected_virtual_e164: '+8613800011111',
    content_type: 'text/plain',
    body: 'hello',
    body_bytes: 5,
    status: 'created'
  });

  db.upsertMessageEvent({
    id: 'msg-1',
    sender_user_id: 'caller-1',
    sender_endpoint: 'alice',
    sender_real_e164: '+8613900000001',
    target_endpoint: 'bob',
    target_e164: '+8613900000002',
    selected_virtual_e164: '+8613800011111',
    content_type: 'text/plain',
    body: 'hello',
    body_bytes: 5,
    status: 'delivered',
    delivered_at: new Date().toISOString()
  });

  const message = db.getMessageById('msg-1');
  assert.ok(message);
  assert.equal(message.message_id, 'msg-1');
  assert.equal(message.status, 'delivered');

  const list = db.listMessages({ status: 'delivered', limit: 10 });
  assert.equal(list.length, 1);
  assert.equal(list[0].message_id, 'msg-1');

  const summary = db.getDashboardSummary();
  assert.equal(summary.messages.total, 1);
  assert.equal(summary.messages.delivered, 1);
  assert.equal(summary.messages.failed, 0);

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
