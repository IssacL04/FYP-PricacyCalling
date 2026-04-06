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

test('state machine treats B-leg DIALSTATUS=ANSWER as successful bridge', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyClientCallCreate',
    CallID: 'client-answer-status',
    CallerEndpoint: 'bob',
    CalleeE164: '+8613900000001',
    TargetEndpoint: 'alice',
    VirtualID: '+8613800011111',
    TimeoutSec: '30',
    Channel: 'PJSIP/bob-00001001'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-answer-status',
    Leg: 'A',
    State: 'answered',
    Channel: 'PJSIP/bob-00001001'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-answer-status',
    Leg: 'B',
    State: 'dIALing',
    Channel: 'PJSIP/alice-00001002'
  });

  // Client direct-dial path reports DIALSTATUS=ANSWER after Dial() returns.
  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-answer-status',
    Leg: 'B',
    State: 'ANSWER',
    Reason: '16'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-answer-status',
    Leg: 'ALL',
    State: 'hangup',
    Reason: '16',
    Channel: 'PJSIP/bob-00001001'
  });

  const call = db.getCallWithLegs('client-answer-status');
  assert.equal(call.b_leg_status, 'hangup');
  assert.equal(call.status, 'completed');
  assert.equal(call.bridge_status, 'released');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('state machine treats B-leg UP as successful bridge', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyClientCallCreate',
    CallID: 'client-up-status',
    CallerEndpoint: 'bob',
    CalleeE164: '+8613900000001',
    TargetEndpoint: 'alice',
    VirtualID: '+8613800011111',
    TimeoutSec: '30',
    Channel: 'PJSIP/bob-00001011'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-up-status',
    Leg: 'A',
    State: 'answered',
    Channel: 'PJSIP/bob-00001011'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-up-status',
    Leg: 'B',
    State: 'UP',
    Channel: 'PJSIP/alice-00001012'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-up-status',
    Leg: 'ALL',
    State: 'hangup',
    Reason: '16',
    Channel: 'PJSIP/bob-00001011'
  });

  const call = db.getCallWithLegs('client-up-status');
  assert.equal(call.status, 'completed');
  assert.equal(call.bridge_status, 'released');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('state machine marks normal clearing as completed when legs are not failed', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyClientCallCreate',
    CallID: 'client-normal-clear',
    CallerEndpoint: 'bob',
    CalleeE164: '+8613900000001',
    TargetEndpoint: 'alice',
    VirtualID: '+8613800011111',
    TimeoutSec: '30',
    Channel: 'PJSIP/bob-00001021'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-normal-clear',
    Leg: 'A',
    State: 'answered',
    Channel: 'PJSIP/bob-00001021'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-normal-clear',
    Leg: 'B',
    State: 'hangup',
    Channel: 'PJSIP/alice-00001022',
    Reason: '16'
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyCallState',
    CallID: 'client-normal-clear',
    Leg: 'ALL',
    State: 'hangup',
    Reason: '16',
    Channel: 'PJSIP/bob-00001021'
  });

  const call = db.getCallWithLegs('client-normal-clear');
  assert.equal(call.status, 'completed');

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('state machine persists PrivacyMessageState lifecycle events', () => {
  const { db, tempDir } = setupDb();
  const sm = new CallStateMachine(db);
  const body = 'hello bob';

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyMessageState',
    MessageID: 'msg-123',
    State: 'created',
    SenderEndpoint: 'alice',
    TargetEndpoint: 'bob',
    TargetE164: '+8613900000002',
    VirtualID: '+8613800011111',
    ContentType: 'text/plain',
    BodyBytes: String(Buffer.byteLength(body, 'utf8')),
    BodyEncoded: encodeURIComponent(body)
  });

  sm.processEvent({
    Event: 'UserEvent',
    UserEvent: 'PrivacyMessageState',
    MessageID: 'msg-123',
    State: 'delivered',
    SenderEndpoint: 'alice',
    TargetEndpoint: 'bob',
    TargetE164: '+8613900000002',
    VirtualID: '+8613800011111',
    ContentType: 'text/plain',
    BodyBytes: String(Buffer.byteLength(body, 'utf8')),
    BodyEncoded: encodeURIComponent(body)
  });

  const message = db.getMessageById('msg-123');
  assert.ok(message);
  assert.equal(message.status, 'delivered');
  assert.equal(message.sender_user_id, 'caller-1');
  assert.equal(message.selected_virtual_e164, '+8613800011111');
  assert.equal(message.body, body);

  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
