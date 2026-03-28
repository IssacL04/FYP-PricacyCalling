const { randomUUID } = require('crypto');
const { AppError } = require('../utils/errors');
const { createJwt } = require('./jwt-utils');
const { normalizeAddress } = require('../blockchain/allowlist-client');

function nowIso() {
  return new Date().toISOString();
}

class BlockchainAuthService {
  constructor({
    challengeStore,
    allowlistClient,
    signatureRecoverClient,
    jwtSecret,
    jwtExpiresSec = 300,
    challengeTtlSec = 60,
    serverOrigin = 'privacy-calling-api'
  }) {
    this.challengeStore = challengeStore;
    this.allowlistClient = allowlistClient;
    this.signatureRecoverClient = signatureRecoverClient;
    this.jwtSecret = String(jwtSecret || '');
    this.jwtExpiresSec = Math.max(30, Number.parseInt(jwtExpiresSec, 10) || 300);
    this.challengeTtlSec = Math.max(10, Number.parseInt(challengeTtlSec, 10) || 60);
    this.serverOrigin = String(serverOrigin || 'privacy-calling-api');
  }

  buildChallengeMessage({ challengeId, address, nodeId, nonce, issuedAtIso }) {
    return [
      'PrivacyCalling Auth Challenge',
      `origin=${this.serverOrigin}`,
      `challenge_id=${challengeId}`,
      `address=${address}`,
      `node_id=${nodeId || '-'}`,
      `nonce=${nonce}`,
      `issued_at=${issuedAtIso}`,
      `ttl_sec=${this.challengeTtlSec}`
    ].join('\n');
  }

  createChallenge({ address, nodeId }) {
    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress || !normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
      throw new AppError('Invalid blockchain address', 400, 'invalid_blockchain_address');
    }

    const safeNodeId = String(nodeId || '').trim();
    const challengeId = randomUUID();
    const nonce = randomUUID();
    const issuedAtIso = nowIso();
    const message = this.buildChallengeMessage({
      challengeId,
      address: normalizedAddress,
      nodeId: safeNodeId,
      nonce,
      issuedAtIso
    });

    const stored = this.challengeStore.create({
      challengeId,
      address: normalizedAddress,
      nodeId: safeNodeId,
      message
    });
    return {
      challenge_id: stored.challenge_id,
      message: stored.message,
      expires_in_sec: stored.expires_in_sec
    };
  }

  async verifyChallenge({ address, nodeId, challengeId, signature }) {
    const normalizedAddress = normalizeAddress(address);
    const safeNodeId = String(nodeId || '').trim();
    const safeChallengeId = String(challengeId || '').trim();
    const safeSignature = String(signature || '').trim();

    if (!normalizedAddress || !safeChallengeId || !safeSignature) {
      throw new AppError('address, challenge_id, signature are required', 400, 'invalid_auth_payload');
    }

    const challenge = this.challengeStore.consume(safeChallengeId);
    if (!challenge) {
      throw new AppError('Challenge not found or already used', 401, 'challenge_invalid');
    }

    const nowMs = Date.now();
    if (challenge.expires_at_ms <= nowMs) {
      throw new AppError('Challenge expired', 401, 'challenge_expired');
    }

    if (challenge.address !== normalizedAddress) {
      throw new AppError('Challenge does not match address', 401, 'challenge_mismatch');
    }

    if (safeNodeId && challenge.node_id && challenge.node_id !== safeNodeId) {
      throw new AppError('Challenge does not match node_id', 401, 'challenge_mismatch');
    }

    const recovered = await this.signatureRecoverClient.recoverAddress({
      message: challenge.message,
      signature: safeSignature
    });

    if (recovered !== normalizedAddress) {
      throw new AppError('Signature verification failed', 401, 'signature_invalid');
    }

    const isAllowed = await this.allowlistClient.isAddressAllowed(normalizedAddress);
    if (!isAllowed) {
      throw new AppError('Address is not allowlisted on chain', 403, 'address_not_allowlisted');
    }

    const jwt = createJwt({
      payload: {
        sub: normalizedAddress,
        node_id: safeNodeId || challenge.node_id || null,
        auth_method: 'blockchain'
      },
      secret: this.jwtSecret,
      expiresSec: this.jwtExpiresSec
    });

    return {
      access_token: jwt.token,
      token_type: 'Bearer',
      expires_in_sec: jwt.expires_in_sec,
      subject_address: normalizedAddress,
      node_id: safeNodeId || challenge.node_id || null,
      auth_method: 'blockchain'
    };
  }

  createDemoSession({ address, nodeId }) {
    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress || !normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
      throw new AppError('Invalid blockchain address', 400, 'invalid_blockchain_address');
    }

    const safeNodeId = String(nodeId || '').trim() || 'demo-node';
    const jwt = createJwt({
      payload: {
        sub: normalizedAddress,
        node_id: safeNodeId,
        auth_method: 'blockchain_demo'
      },
      secret: this.jwtSecret,
      expiresSec: this.jwtExpiresSec
    });

    return {
      access_token: jwt.token,
      token_type: 'Bearer',
      expires_in_sec: jwt.expires_in_sec,
      subject_address: normalizedAddress,
      node_id: safeNodeId,
      auth_method: 'blockchain_demo'
    };
  }
}

module.exports = {
  BlockchainAuthService
};
