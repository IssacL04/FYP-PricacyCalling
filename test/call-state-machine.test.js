const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseService } = require('../src/db');
const { CallStateMachine } = require('../src/services/call-state-machine');

function setupDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'privacy-sm-test-'));
  const dbPath = path.join(tempDir, 'test.db');
  const db = new DatabaseService(dbPath);

  db.db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES ('caller-1', 'Caller', '+8613900000001', 'alice', 1, datetime('now'), datetime('now'))
  `).run();

  db.db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES ('caller-2', 'Caller2', '+8613900000002', 'bob', 1, datetime('now'), datetime('now'))
  `).run();

  db.db.prepare(`
    INSERT INTO virtual_numbers (e164, enabled, created_at, updated_at)
    VALUES ('+8613800011111', 1, datetime('now'), datetime('now'))
  `).run();

  db.createCallWithLegs({
    call: {
      id: 'call-1',
      caller_user_id: 'caller-1',
      caller_real_e164: '+8613900000001',
      callee_e164: '+8613900000002',
      selected_virtual_number_id: 1,
      selected_virtual_e164: '+8613800011111',
      trunk_name: 'local',
      dial_target: 'PJSIP/bob',
      action_id: 'orig-call-1',
      status: 'created',
      bridge_status: 'pending',
      failure_reason: null,
      requested_by: 'test',
      timeout_sec: 30,
      started_at: null,
      ended_at: null
    },
    aLeg: { channel: 'PJSIP/alice', status: 'pending' },
    bLeg: { channel: 'PJSIP/bob', status: 'pending' }
  });

  return {
    db,
    tempDir
  };
}

test('state machine transitions created -> bridged -> completed', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);
  sm.registerAction('call-1', 'orig-call-1');

  sm.processEvent({
    Event: 'OriginateResponse',
    ActionID: 'orig-call-1',
    Response: 'Success',
    Channel: 'PJSIP/alice-0000001'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'call-1',
    Leg: 'A',
    State: 'answered',
    Channel: 'PJSIP/alice-0000001'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'call-1',
    Leg: 'B',
    State: 'dialing',
    Channel: 'PJSIP/bob-0000002'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'call-1',
    Leg: 'B',
    State: 'answered',
    Channel: 'PJSIP/bob-0000002'
  });

  let call = db.getCallWithLegs('call-1');
  assert.equal(call.status, 'bridged');
  assert.equal(call.bridge_status, 'bridged');
  assert.equal(call.b_leg_status, 'answered');

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'call-1',
    Leg: 'ALL',
    State: 'hangup',
    Reason: '16'
  });

  call = db.getCallWithLegs('call-1');
  assert.equal(call.status, 'completed');
  assert.equal(call.bridge_status, 'released');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('state machine creates record for direct client call events', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyClientCallCreate',
    CallID: 'client-123',
    CallerEndpoint: 'bob',
    CalleeE164: '+8613900000001',
    TargetEndpoint: 'alice',
    VirtualID: '+8613800011111',
    TimeoutSec: '30',
    Channel: 'PJSIP/bob-00000099'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-123',
    Leg: 'A',
    State: 'answered',
    Channel: 'PJSIP/bob-00000099'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-123',
    Leg: 'B',
    State: 'answered',
    Channel: 'PJSIP/alice-00000100'
  });

  let call = db.getCallWithLegs('client-123');
  assert.equal(call.caller_user_id, 'caller-2');
  assert.equal(call.status, 'bridged');
  assert.equal(call.selected_virtual_id, '+8613800011111');

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-123',
    Leg: 'ALL',
    State: 'hangup',
    Reason: '16',
    Channel: 'PJSIP/bob-00000099'
  });

  call = db.getCallWithLegs('client-123');
  assert.equal(call.status, 'completed');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
