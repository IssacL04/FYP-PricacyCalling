const { randomUUID } = require('crypto');
const { normalizeE164 } = require('../utils/phone');
const { AppError } = require('../utils/errors');

function isoNow() {
  return new Date().toISOString();
}

class CallService {
  constructor({ db, amiClient, identityPolicy, callStateMachine, config }) {
    this.db = db;
    this.amiClient = amiClient;
    this.identityPolicy = identityPolicy;
    this.callStateMachine = callStateMachine;
    this.config = config;
  }

  resolveDialTarget(calleeE164) {
    const trunk = this.db.getDefaultTrunk();
    if (trunk) {
      return {
        dialTarget: `PJSIP/${calleeE164}@${trunk.name}`,
        trunkName: trunk.name
      };
    }

    const localUser = this.db.getUserByRealE164(calleeE164);
    if (localUser) {
      return {
        dialTarget: `PJSIP/${localUser.caller_endpoint}`,
        trunkName: 'local'
      };
    }

    throw new AppError(
      'No default trunk is configured and local callee endpoint was not found',
      412,
      'trunk_not_configured'
    );
  }

  async createCall({ callerUserId, calleeE164, timeoutSec, requestedBy }) {
    const caller = this.db.getUserById(callerUserId);
    if (!caller) {
      throw new AppError('caller_user_id not found or disabled', 404, 'caller_not_found');
    }

    const normalizedCallee = normalizeE164(calleeE164, 'callee_e164');
    const selectedVirtual = this.identityPolicy.selectVirtualIdentity({
      calleeE164: normalizedCallee
    });

    const timeout = Math.min(
      Math.max(timeoutSec || this.config.call.timeoutSecDefault, 5),
      this.config.call.timeoutSecMax
    );

    const route = this.resolveDialTarget(normalizedCallee);
    const callId = randomUUID();
    const callRecord = {
      id: callId,
      caller_user_id: caller.id,
      caller_real_e164: caller.real_e164,
      callee_e164: normalizedCallee,
      selected_virtual_number_id: selectedVirtual.id,
      selected_virtual_e164: selectedVirtual.e164,
      trunk_name: route.trunkName,
      dial_target: route.dialTarget,
      action_id: null,
      status: 'created',
      bridge_status: 'pending',
      failure_reason: null,
      requested_by: requestedBy,
      timeout_sec: timeout,
      started_at: null,
      ended_at: null
    };

    this.db.createCallWithLegs({
      call: callRecord,
      aLeg: {
        channel: `PJSIP/${caller.caller_endpoint}`,
        status: 'pending'
      },
      bLeg: {
        channel: route.dialTarget,
        status: 'pending'
      }
    });

    if (!this.amiClient.status().authenticated) {
      this.db.withTransaction(() => {
        this.db.updateCallStatus({
          id: callId,
          status: 'failed',
          bridgeStatus: 'pending',
          failureReason: 'ami_not_connected',
          endedAt: isoNow()
        });
        this.db.updateLegStatus(callId, 'A', 'failed', null, 'ami_not_connected');
        this.db.updateLegStatus(callId, 'B', 'failed', null, 'ami_not_connected');
      });

      throw new AppError('Asterisk AMI is not connected', 503, 'asterisk_unavailable');
    }

    const actionId = `orig-${callId}`;
    this.db.setCallActionId(callId, actionId);
    this.callStateMachine.registerAction(callId, actionId);
    this.db.updateCallStatus({
      id: callId,
      status: 'originating',
      bridgeStatus: 'pending',
      startedAt: isoNow()
    });
    this.db.updateLegStatus(callId, 'A', 'ringing');

    const originateVariables = [
      `__CALL_ID=${callId}`,
      `CALLEE_E164=${normalizedCallee}`,
      `VIRTUAL_ID=${selectedVirtual.e164}`,
      `B_DIALSTR=${route.dialTarget}`,
      `TRUNK_NAME=${route.trunkName}`,
      `CALL_TIMEOUT_SEC=${timeout}`
    ];

    try {
      const response = await this.amiClient.sendAction({
        Action: 'Originate',
        ActionID: actionId,
        Channel: `PJSIP/${caller.caller_endpoint}`,
        Context: this.config.asterisk.context,
        Exten: this.config.asterisk.exten,
        Priority: this.config.asterisk.priority,
        Async: 'true',
        CallerID: `PrivacyProxy <${selectedVirtual.e164}>`,
        Timeout: timeout * 1000,
        Variable: originateVariables
      });

      if (response.Response !== 'Success') {
        throw new Error(response.Message || 'Originate rejected');
      }

      return {
        call_id: callId,
        selected_virtual_id: selectedVirtual.e164,
        status: 'originating'
      };
    } catch (error) {
      this.db.withTransaction(() => {
        this.db.updateCallStatus({
          id: callId,
          status: 'failed',
          bridgeStatus: 'pending',
          failureReason: error.message || 'originate_failed',
          endedAt: isoNow()
        });
        this.db.updateLegStatus(callId, 'A', 'failed', null, error.message || 'originate_failed');
        this.db.updateLegStatus(callId, 'B', 'failed', null, error.message || 'originate_failed');
      });

      throw new AppError('Failed to originate call', 502, 'originate_failed', {
        reason: error.message
      });
    }
  }

  getCall(callId) {
    const found = this.db.getCallWithLegs(callId);
    if (!found) {
      throw new AppError('call not found', 404, 'call_not_found');
    }
    return found;
  }
}

module.exports = {
  CallService
};
