const { AppError } = require('../utils/errors');

function nowSql() {
  return new Date().toISOString();
}

function isNormalClearingReason(reason) {
  const raw = String(reason || '').trim().toLowerCase();
  return raw === '16' || raw === 'normal_clearing' || raw === 'normal clearing';
}

function computeTerminalStatus(current, reason) {
  const aFailed = current.a_leg_status === 'failed';
  const bFailed = current.b_leg_status === 'failed';
  const anyFailed = aFailed || bFailed;
  if (anyFailed) {
    return 'failed';
  }

  const bridged = current.bridge_status === 'bridged' || current.b_leg_status === 'answered';
  if (bridged) {
    return 'completed';
  }

  if (isNormalClearingReason(reason)) {
    return 'completed';
  }

  return 'failed';
}

class CallStateMachine {
  constructor(db) {
    this.db = db;
    this.actionToCall = new Map();
    this.channelToCall = new Map();
  }

  registerAction(callId, actionId) {
    if (actionId) {
      this.actionToCall.set(actionId, callId);
    }
  }

  processEvent(event) {
    if (!event || typeof event !== 'object') {
      return;
    }

    if (event.Event === 'OriginateResponse') {
      this.handleOriginateResponse(event);
      return;
    }

    if (event.Event === 'UserEvent' && event.UserEvent === 'PrivacyCallState') {
      this.handlePrivacyStateEvent(event);
      return;
    }

    if (event.Event === 'UserEvent' && event.UserEvent === 'PrivacyClientCallCreate') {
      this.handlePrivacyClientCreateEvent(event);
      return;
    }

    if (event.Event === 'Hangup') {
      this.handleHangupEvent(event);
    }
  }

  resolveCallIdFromEvent(event) {
    return (
      event.CallID ||
      event.CALL_ID ||
      event.CallId ||
      (event.ActionID ? this.actionToCall.get(event.ActionID) : null) ||
      (event.Channel ? this.channelToCall.get(event.Channel) : null) ||
      (event.DestChannel ? this.channelToCall.get(event.DestChannel) : null)
    );
  }

  handlePrivacyClientCreateEvent(event) {
    const callId = this.resolveCallIdFromEvent(event);
    if (!callId) {
      return;
    }

    const existing = this.db.getCallWithLegs(callId);
    if (existing) {
      if (event.Channel) {
        this.channelToCall.set(event.Channel, callId);
      }
      return;
    }

    const callerEndpoint = event.CallerEndpoint;
    const calleeE164 = event.CalleeE164;
    const virtualE164 = event.VirtualID;
    const targetEndpoint = event.TargetEndpoint;
    const timeoutSecRaw = Number.parseInt(event.TimeoutSec, 10);
    const timeoutSec = Number.isFinite(timeoutSecRaw) && timeoutSecRaw > 0 ? timeoutSecRaw : 30;

    if (!callerEndpoint || !calleeE164 || !virtualE164) {
      return;
    }

    const caller = this.db.getUserByEndpoint(callerEndpoint);
    const virtual = this.db.getVirtualNumberByE164(virtualE164);
    if (!caller || !virtual) {
      return;
    }

    const dialTarget = targetEndpoint ? `PJSIP/${targetEndpoint}` : '';

    this.db.createCallWithLegs({
      call: {
        id: callId,
        caller_user_id: caller.id,
        caller_real_e164: caller.real_e164,
        callee_e164: calleeE164,
        selected_virtual_number_id: virtual.id,
        selected_virtual_e164: virtual.e164,
        trunk_name: 'local-client',
        dial_target: dialTarget,
        action_id: `direct-${callId}`,
        status: 'created',
        bridge_status: 'pending',
        failure_reason: null,
        requested_by: 'sip-client',
        timeout_sec: timeoutSec,
        started_at: null,
        ended_at: null
      },
      aLeg: {
        channel: event.Channel || `PJSIP/${callerEndpoint}`,
        status: 'pending'
      },
      bLeg: {
        channel: dialTarget || null,
        status: 'pending'
      }
    });

    if (event.Channel) {
      this.channelToCall.set(event.Channel, callId);
    }
  }

  handleOriginateResponse(event) {
    const callId = this.resolveCallIdFromEvent(event);
    if (!callId) {
      return;
    }

    if (event.Channel) {
      this.channelToCall.set(event.Channel, callId);
    }

    if (event.Response === 'Failure') {
      const reason = event.Reason || event.Message || 'originate_failed';
      this.db.withTransaction(() => {
        this.db.updateCallStatus({
          id: callId,
          status: 'failed',
          bridgeStatus: 'pending',
          failureReason: reason,
          endedAt: nowSql()
        });
        this.db.updateLegStatus(callId, 'A', 'failed', event.Channel || null, reason);
        this.db.updateLegStatus(callId, 'B', 'failed', null, reason);
      });
      return;
    }

    this.db.updateCallStatus({
      id: callId,
      status: 'ringing',
      bridgeStatus: 'pending',
      startedAt: nowSql()
    });
    this.db.updateLegStatus(callId, 'A', 'ringing', event.Channel || null);
  }

  handlePrivacyStateEvent(event) {
    const callId = this.resolveCallIdFromEvent(event);
    if (!callId) {
      return;
    }

    const leg = event.Leg;
    const stateRaw = event.State || '';
    const state = stateRaw.toLowerCase();
    const channel = event.Channel || null;
    const reason = event.Reason || stateRaw;

    if (channel) {
      this.channelToCall.set(channel, callId);
    }

    this.db.withTransaction(() => {
      const successStates = new Set(['answered', 'answer', 'up', 'bridged', 'bridge']);

      if (leg === 'A') {
        if (successStates.has(state)) {
          this.db.updateLegStatus(callId, 'A', 'answered', channel);
          this.db.updateCallStatus({ id: callId, status: 'answered', bridgeStatus: 'pending' });
          return;
        }
        if (state === 'ringing') {
          this.db.updateLegStatus(callId, 'A', 'ringing', channel);
          this.db.updateCallStatus({ id: callId, status: 'ringing', bridgeStatus: 'pending' });
          return;
        }
        if (state === 'hangup') {
          this.db.updateLegStatus(callId, 'A', 'hangup', channel, reason);
          return;
        }
      }

      if (leg === 'B') {
        if (state === 'dialing') {
          this.db.updateLegStatus(callId, 'B', 'ringing', channel);
          this.db.updateCallStatus({ id: callId, status: 'ringing', bridgeStatus: 'pending' });
          return;
        }
        if (successStates.has(state)) {
          this.db.updateLegStatus(callId, 'B', 'answered', channel);
          this.db.updateCallStatus({
            id: callId,
            status: 'bridged',
            bridgeStatus: 'bridged'
          });
          return;
        }

        const failStates = new Set(['busy', 'noanswer', 'cancel', 'chanunavail', 'congestion', 'failed']);
        if (failStates.has(state)) {
          this.db.updateLegStatus(callId, 'B', 'failed', channel, reason);
          this.db.updateCallStatus({
            id: callId,
            status: 'failed',
            bridgeStatus: 'pending',
            failureReason: reason,
            endedAt: nowSql()
          });
          return;
        }

        if (state && state !== 'hangup') {
          this.db.updateLegStatus(callId, 'B', 'failed', channel, reason);
          this.db.updateCallStatus({
            id: callId,
            status: 'failed',
            bridgeStatus: 'pending',
            failureReason: reason,
            endedAt: nowSql()
          });
          return;
        }

        if (state === 'hangup') {
          this.db.updateLegStatus(callId, 'B', 'hangup', channel, reason);
          return;
        }
      }

      if (leg === 'ALL' && state === 'hangup') {
        const current = this.db.getCallWithLegs(callId);
        if (!current) {
          throw new AppError(`call ${callId} not found`, 404, 'call_not_found');
        }

        const finalStatus = computeTerminalStatus(current, reason);
        const bridgeStatus = current.bridge_status === 'bridged' ? 'released' : 'pending';

        this.db.updateLegStatus(callId, 'A', current.a_leg_status === 'failed' ? 'failed' : 'hangup', channel, reason);
        this.db.updateLegStatus(callId, 'B', current.b_leg_status === 'failed' ? 'failed' : 'hangup', channel, reason);
        this.db.updateCallStatus({
          id: callId,
          status: finalStatus,
          bridgeStatus,
          failureReason: finalStatus === 'failed' ? current.failure_reason || reason : null,
          endedAt: nowSql()
        });
      }
    });
  }

  handleHangupEvent(event) {
    const callId = this.resolveCallIdFromEvent(event);
    if (!callId) {
      return;
    }

    const current = this.db.getCallWithLegs(callId);
    if (!current) {
      return;
    }

    if (current.status === 'failed' || current.status === 'completed') {
      return;
    }

    const reason = event.Cause || event.CauseTxt || event.Reason || 'hangup_before_bridge';
    const finalStatus = computeTerminalStatus(current, reason);
    this.db.updateCallStatus({
      id: callId,
      status: finalStatus,
      bridgeStatus: current.bridge_status === 'bridged' ? 'released' : 'pending',
      failureReason: finalStatus === 'failed' ? current.failure_reason || 'hangup_before_bridge' : null,
      endedAt: nowSql()
    });
  }
}

module.exports = {
  CallStateMachine
};
