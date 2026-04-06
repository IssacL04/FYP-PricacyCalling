const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { AppError } = require('../utils/errors');

const ACTIVE_CALL_STATUSES = ['originating', 'ringing', 'answered', 'bridged'];
const MESSAGE_STATUSES = ['created', 'routing', 'delivered', 'failed'];

function nowExpr() {
  return "datetime('now')";
}

class DatabaseService {
  constructor(dbPath) {
    const parent = path.dirname(dbPath);
    fs.mkdirSync(parent, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.migrate();

    this.stmts = {
      health: this.db.prepare('SELECT 1 AS ok'),
      getUserById: this.db.prepare('SELECT * FROM users WHERE id = ? AND enabled = 1'),
      getUserByRealE164: this.db.prepare('SELECT * FROM users WHERE real_e164 = ? AND enabled = 1'),
      getUserByEndpoint: this.db.prepare('SELECT * FROM users WHERE caller_endpoint = ? AND enabled = 1'),
      getVirtualByE164: this.db.prepare('SELECT * FROM virtual_numbers WHERE e164 = ? AND enabled = 1'),
      getMappedVirtualByCallee: this.db.prepare(`
        SELECT v.*
        FROM id_mappings m
        JOIN virtual_numbers v ON v.id = m.virtual_number_id
        WHERE m.callee_e164 = ? AND v.enabled = 1
      `),
      getFirstVirtual: this.db.prepare('SELECT * FROM virtual_numbers WHERE enabled = 1 ORDER BY id ASC'),
      checkVirtualBusy: this.db.prepare(`
        SELECT COUNT(1) AS c
        FROM calls
        WHERE selected_virtual_number_id = ?
          AND status IN (${ACTIVE_CALL_STATUSES.map(() => '?').join(',')})
      `),
      upsertMapping: this.db.prepare(`
        INSERT INTO id_mappings (callee_e164, virtual_number_id, updated_at)
        VALUES (?, ?, ${nowExpr()})
        ON CONFLICT(callee_e164)
        DO UPDATE SET
          virtual_number_id = excluded.virtual_number_id,
          updated_at = ${nowExpr()}
      `),
      getDefaultTrunk: this.db.prepare(`
        SELECT * FROM trunks
        WHERE enabled = 1 AND is_default = 1
        ORDER BY id ASC
        LIMIT 1
      `),
      insertCall: this.db.prepare(`
        INSERT INTO calls (
          id, caller_user_id, caller_real_e164, callee_e164,
          selected_virtual_number_id, selected_virtual_e164,
          trunk_name, dial_target, action_id,
          status, bridge_status, failure_reason,
          requested_by, timeout_sec,
          created_at, started_at, ended_at, updated_at
        ) VALUES (
          @id, @caller_user_id, @caller_real_e164, @callee_e164,
          @selected_virtual_number_id, @selected_virtual_e164,
          @trunk_name, @dial_target, @action_id,
          @status, @bridge_status, @failure_reason,
          @requested_by, @timeout_sec,
          ${nowExpr()}, @started_at, @ended_at, ${nowExpr()}
        )
      `),
      insertLeg: this.db.prepare(`
        INSERT INTO call_legs (call_id, leg_type, channel, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ${nowExpr()}, ${nowExpr()})
      `),
      updateCallActionId: this.db.prepare(`
        UPDATE calls
        SET action_id = ?, updated_at = ${nowExpr()}
        WHERE id = ?
      `),
      updateCallStatus: this.db.prepare(`
        UPDATE calls
        SET status = @status,
            bridge_status = COALESCE(@bridge_status, bridge_status),
            failure_reason = COALESCE(@failure_reason, failure_reason),
            started_at = COALESCE(@started_at, started_at),
            ended_at = COALESCE(@ended_at, ended_at),
            updated_at = ${nowExpr()}
        WHERE id = @id
      `),
      updateLegStatus: this.db.prepare(`
        UPDATE call_legs
        SET status = ?,
            channel = COALESCE(?, channel),
            hangup_cause = COALESCE(?, hangup_cause),
            updated_at = ${nowExpr()}
        WHERE call_id = ? AND leg_type = ?
      `),
      getCallById: this.db.prepare('SELECT * FROM calls WHERE id = ?'),
      getLegsByCallId: this.db.prepare('SELECT * FROM call_legs WHERE call_id = ?'),
      getCallByActionId: this.db.prepare('SELECT * FROM calls WHERE action_id = ? LIMIT 1'),
      listVirtuals: this.db.prepare('SELECT * FROM virtual_numbers WHERE enabled = 1 ORDER BY id ASC'),
      getDashboardCallStats: this.db.prepare(`
        SELECT
          COUNT(1) AS total_calls,
          COALESCE(SUM(CASE WHEN status IN (${ACTIVE_CALL_STATUSES.map(() => '?').join(',')}) THEN 1 ELSE 0 END), 0) AS active_calls,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_calls,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_calls
        FROM calls
      `),
      getDashboard24hStats: this.db.prepare(`
        SELECT
          COUNT(1) AS calls_last_24h,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_last_24h
        FROM calls
        WHERE created_at >= datetime('now', '-1 day')
      `),
      getDashboardUserStats: this.db.prepare(`
        SELECT
          COUNT(1) AS total_users,
          COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled_users
        FROM users
      `),
      getDashboardVirtualStats: this.db.prepare(`
        SELECT
          COUNT(1) AS total_virtual_numbers,
          COALESCE(SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled_virtual_numbers
        FROM virtual_numbers
      `),
      getRecentCalls: this.db.prepare(`
        SELECT
          id,
          status,
          bridge_status,
          caller_user_id,
          callee_e164,
          selected_virtual_e164,
          created_at,
          ended_at,
          failure_reason
        FROM calls
        ORDER BY created_at DESC
        LIMIT ?
      `),
      upsertMessage: this.db.prepare(`
        INSERT INTO messages (
          id,
          sender_user_id,
          sender_endpoint,
          sender_real_e164,
          target_endpoint,
          target_e164,
          selected_virtual_e164,
          content_type,
          body,
          body_bytes,
          status,
          failure_reason,
          delivered_at,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @sender_user_id,
          @sender_endpoint,
          @sender_real_e164,
          @target_endpoint,
          @target_e164,
          @selected_virtual_e164,
          @content_type,
          @body,
          @body_bytes,
          @status,
          @failure_reason,
          @delivered_at,
          COALESCE(@created_at, ${nowExpr()}),
          ${nowExpr()}
        )
        ON CONFLICT(id) DO UPDATE SET
          sender_user_id = excluded.sender_user_id,
          sender_endpoint = excluded.sender_endpoint,
          sender_real_e164 = excluded.sender_real_e164,
          target_endpoint = excluded.target_endpoint,
          target_e164 = excluded.target_e164,
          selected_virtual_e164 = excluded.selected_virtual_e164,
          content_type = excluded.content_type,
          body = excluded.body,
          body_bytes = excluded.body_bytes,
          status = excluded.status,
          failure_reason = excluded.failure_reason,
          delivered_at = COALESCE(excluded.delivered_at, messages.delivered_at),
          updated_at = ${nowExpr()}
      `),
      getMessageById: this.db.prepare('SELECT * FROM messages WHERE id = ? LIMIT 1'),
      listMessages: this.db.prepare(`
        SELECT
          id,
          sender_user_id,
          sender_endpoint,
          sender_real_e164,
          target_endpoint,
          target_e164,
          selected_virtual_e164,
          content_type,
          body,
          body_bytes,
          status,
          failure_reason,
          created_at,
          delivered_at,
          updated_at
        FROM messages
        WHERE (@status IS NULL OR status = @status)
          AND (
            @since_sec IS NULL
            OR created_at >= datetime('now', '-' || @since_sec || ' seconds')
          )
        ORDER BY created_at DESC, id DESC
        LIMIT @limit
      `),
      getDashboardMessageStats: this.db.prepare(`
        SELECT
          COUNT(1) AS total_messages,
          COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_messages,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_messages,
          COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END), 0) AS messages_last_24h,
          COALESCE(
            SUM(
              CASE
                WHEN status = 'failed' AND created_at >= datetime('now', '-1 day') THEN 1
                ELSE 0
              END
            ),
            0
          ) AS failed_last_24h
        FROM messages
      `),
      getRecentMessages: this.db.prepare(`
        SELECT
          id,
          sender_user_id,
          sender_endpoint,
          sender_real_e164,
          target_endpoint,
          target_e164,
          selected_virtual_e164,
          content_type,
          body,
          body_bytes,
          status,
          failure_reason,
          created_at,
          delivered_at
        FROM messages
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `),
      insertOpsAuditEvent: this.db.prepare(`
        INSERT INTO ops_audit_events (
          actor,
          action,
          target,
          result,
          details,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ${nowExpr()})
      `),
      listOpsAuditEvents: this.db.prepare(`
        SELECT
          id,
          actor,
          action,
          target,
          result,
          details,
          created_at
        FROM ops_audit_events
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
    };
  }

  migrate() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schema);
  }

  close() {
    this.db.close();
  }

  healthCheck() {
    return this.stmts.health.get();
  }

  withTransaction(fn) {
    return this.db.transaction(fn)();
  }

  getUserById(userId) {
    return this.stmts.getUserById.get(userId);
  }

  getUserByRealE164(e164) {
    return this.stmts.getUserByRealE164.get(e164);
  }

  getUserByEndpoint(endpoint) {
    return this.stmts.getUserByEndpoint.get(endpoint);
  }

  getVirtualNumberByE164(e164) {
    return this.stmts.getVirtualByE164.get(e164);
  }

  getMappedVirtualNumberForCallee(calleeE164) {
    return this.stmts.getMappedVirtualByCallee.get(calleeE164);
  }

  isVirtualNumberAvailable(virtualNumberId) {
    const row = this.stmts.checkVirtualBusy.get(virtualNumberId, ...ACTIVE_CALL_STATUSES);
    return row.c === 0;
  }

  getFirstAvailableVirtualNumber() {
    const all = this.stmts.listVirtuals.all();
    return all.find((candidate) => this.isVirtualNumberAvailable(candidate.id)) || null;
  }

  upsertMapping(calleeE164, virtualNumberId) {
    this.stmts.upsertMapping.run(calleeE164, virtualNumberId);
  }

  getDefaultTrunk() {
    return this.stmts.getDefaultTrunk.get() || null;
  }

  createCallWithLegs({ call, aLeg, bLeg }) {
    this.withTransaction(() => {
      this.stmts.insertCall.run(call);
      this.stmts.insertLeg.run(call.id, 'A', aLeg.channel || null, aLeg.status || 'pending');
      this.stmts.insertLeg.run(call.id, 'B', bLeg.channel || null, bLeg.status || 'pending');
    });
  }

  setCallActionId(callId, actionId) {
    this.stmts.updateCallActionId.run(actionId, callId);
  }

  getCallByActionId(actionId) {
    return this.stmts.getCallByActionId.get(actionId);
  }

  updateCallStatus({
    id,
    status,
    bridgeStatus = null,
    failureReason = null,
    startedAt = null,
    endedAt = null
  }) {
    const info = this.stmts.updateCallStatus.run({
      id,
      status,
      bridge_status: bridgeStatus,
      failure_reason: failureReason,
      started_at: startedAt,
      ended_at: endedAt
    });

    if (info.changes === 0) {
      throw new AppError(`call ${id} not found`, 404, 'call_not_found');
    }
  }

  updateLegStatus(callId, legType, status, channel = null, hangupCause = null) {
    this.stmts.updateLegStatus.run(status, channel, hangupCause, callId, legType);
  }

  getCallWithLegs(callId) {
    const call = this.stmts.getCallById.get(callId);
    if (!call) {
      return null;
    }

    const legs = this.stmts.getLegsByCallId.all(callId);
    const aLeg = legs.find((leg) => leg.leg_type === 'A');
    const bLeg = legs.find((leg) => leg.leg_type === 'B');

    return {
      call_id: call.id,
      status: call.status,
      a_leg_status: aLeg ? aLeg.status : 'unknown',
      b_leg_status: bLeg ? bLeg.status : 'unknown',
      bridge_status: call.bridge_status,
      selected_virtual_id: call.selected_virtual_e164,
      caller_user_id: call.caller_user_id,
      callee_e164: call.callee_e164,
      failure_reason: call.failure_reason,
      started_at: call.started_at,
      created_at: call.created_at,
      ended_at: call.ended_at,
      trunk_name: call.trunk_name
    };
  }

  getDashboardSummary() {
    const calls = this.stmts.getDashboardCallStats.get(...ACTIVE_CALL_STATUSES);
    const calls24h = this.stmts.getDashboard24hStats.get();
    const messages = this.stmts.getDashboardMessageStats.get();
    const users = this.stmts.getDashboardUserStats.get();
    const virtualNumbers = this.stmts.getDashboardVirtualStats.get();

    return {
      calls: {
        total: calls.total_calls,
        active: calls.active_calls,
        completed: calls.completed_calls,
        failed: calls.failed_calls,
        last_24h: calls24h.calls_last_24h,
        failed_last_24h: calls24h.failed_last_24h
      },
      messages: {
        total: messages.total_messages,
        delivered: messages.delivered_messages,
        failed: messages.failed_messages,
        last_24h: messages.messages_last_24h,
        failed_last_24h: messages.failed_last_24h
      },
      users: {
        total: users.total_users,
        enabled: users.enabled_users
      },
      virtual_numbers: {
        total: virtualNumbers.total_virtual_numbers,
        enabled: virtualNumbers.enabled_virtual_numbers
      }
    };
  }

  getRecentCalls(limit = 8) {
    const safeLimit = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 8));
    return this.stmts.getRecentCalls.all(safeLimit).map((row) => ({
      call_id: row.id,
      status: row.status,
      bridge_status: row.bridge_status,
      caller_user_id: row.caller_user_id,
      callee_e164: row.callee_e164,
      selected_virtual_id: row.selected_virtual_e164,
      created_at: row.created_at,
      ended_at: row.ended_at,
      failure_reason: row.failure_reason
    }));
  }

  upsertMessageEvent(messageEvent) {
    this.stmts.upsertMessage.run({
      id: String(messageEvent.id || '').trim(),
      sender_user_id: String(messageEvent.sender_user_id || '').trim(),
      sender_endpoint: String(messageEvent.sender_endpoint || '').trim(),
      sender_real_e164: String(messageEvent.sender_real_e164 || '').trim(),
      target_endpoint: String(messageEvent.target_endpoint || '').trim(),
      target_e164: String(messageEvent.target_e164 || '').trim(),
      selected_virtual_e164: String(messageEvent.selected_virtual_e164 || '').trim(),
      content_type: String(messageEvent.content_type || 'text/plain').trim(),
      body: String(messageEvent.body || ''),
      body_bytes: Number.isFinite(Number(messageEvent.body_bytes))
        ? Number(messageEvent.body_bytes)
        : Buffer.byteLength(String(messageEvent.body || ''), 'utf8'),
      status: String(messageEvent.status || 'created').trim().toLowerCase(),
      failure_reason: messageEvent.failure_reason ? String(messageEvent.failure_reason).trim() : null,
      delivered_at: messageEvent.delivered_at || null,
      created_at: messageEvent.created_at || null
    });
  }

  getMessageById(messageId) {
    const row = this.stmts.getMessageById.get(String(messageId || '').trim());
    if (!row) {
      return null;
    }

    return {
      message_id: row.id,
      sender_user_id: row.sender_user_id,
      sender_endpoint: row.sender_endpoint,
      sender_real_e164: row.sender_real_e164,
      target_endpoint: row.target_endpoint,
      target_e164: row.target_e164,
      selected_virtual_e164: row.selected_virtual_e164,
      content_type: row.content_type,
      body: row.body,
      body_bytes: row.body_bytes,
      status: row.status,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
      updated_at: row.updated_at
    };
  }

  listMessages({
    limit = 30,
    status = null,
    sinceSec = null
  } = {}) {
    const safeLimit = Math.max(1, Math.min(200, Number.parseInt(limit, 10) || 30));
    const normalizedStatus = status && MESSAGE_STATUSES.includes(String(status).toLowerCase())
      ? String(status).toLowerCase()
      : null;
    const safeSinceSec = Number.isFinite(Number(sinceSec)) && Number(sinceSec) > 0
      ? Math.min(7 * 24 * 3600, Number.parseInt(sinceSec, 10))
      : null;

    return this.stmts.listMessages.all({
      limit: safeLimit,
      status: normalizedStatus,
      since_sec: safeSinceSec
    }).map((row) => ({
      message_id: row.id,
      sender_user_id: row.sender_user_id,
      sender_endpoint: row.sender_endpoint,
      sender_real_e164: row.sender_real_e164,
      target_endpoint: row.target_endpoint,
      target_e164: row.target_e164,
      selected_virtual_e164: row.selected_virtual_e164,
      content_type: row.content_type,
      body: row.body,
      body_bytes: row.body_bytes,
      status: row.status,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
      updated_at: row.updated_at
    }));
  }

  getRecentMessages(limit = 10) {
    const safeLimit = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 10));
    return this.stmts.getRecentMessages.all(safeLimit).map((row) => ({
      message_id: row.id,
      sender_user_id: row.sender_user_id,
      sender_endpoint: row.sender_endpoint,
      sender_real_e164: row.sender_real_e164,
      target_endpoint: row.target_endpoint,
      target_e164: row.target_e164,
      selected_virtual_e164: row.selected_virtual_e164,
      content_type: row.content_type,
      body: row.body,
      body_bytes: row.body_bytes,
      status: row.status,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      delivered_at: row.delivered_at
    }));
  }

  addOpsAuditEvent({ actor, action, target, result, details = null }) {
    const serializedDetails = details === null || details === undefined
      ? null
      : JSON.stringify(details);

    this.stmts.insertOpsAuditEvent.run(
      String(actor || 'unknown'),
      String(action || 'unknown_action'),
      String(target || '-'),
      String(result || 'unknown'),
      serializedDetails
    );
  }

  listOpsAuditEvents(limit = 30) {
    const safeLimit = Math.max(1, Math.min(200, Number.parseInt(limit, 10) || 30));

    return this.stmts.listOpsAuditEvents.all(safeLimit).map((row) => {
      let parsedDetails = null;
      if (row.details) {
        try {
          parsedDetails = JSON.parse(row.details);
        } catch (error) {
          parsedDetails = { raw: row.details };
        }
      }

      return {
        id: row.id,
        actor: row.actor,
        action: row.action,
        target: row.target,
        result: row.result,
        details: parsedDetails,
        created_at: row.created_at
      };
    });
  }
}

module.exports = {
  DatabaseService,
  ACTIVE_CALL_STATUSES,
  MESSAGE_STATUSES
};
