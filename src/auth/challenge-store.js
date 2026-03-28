const { randomUUID } = require('crypto');

class ChallengeStore {
  constructor({ ttlSec = 60 } = {}) {
    this.ttlSec = Math.max(10, Number.parseInt(ttlSec, 10) || 60);
    this.challenges = new Map();
  }

  cleanupExpired(nowMs = Date.now()) {
    for (const [id, challenge] of this.challenges.entries()) {
      if (challenge.expires_at_ms <= nowMs) {
        this.challenges.delete(id);
      }
    }
  }

  create({ challengeId, address, nodeId, message }) {
    const nowMs = Date.now();
    this.cleanupExpired(nowMs);

    const finalChallengeId = String(challengeId || randomUUID());
    const expiresAtMs = nowMs + this.ttlSec * 1000;

    const record = {
      challenge_id: finalChallengeId,
      address: String(address || '').trim().toLowerCase(),
      node_id: String(nodeId || '').trim(),
      message: String(message || ''),
      created_at_ms: nowMs,
      expires_at_ms: expiresAtMs,
      used: false
    };

    this.challenges.set(finalChallengeId, record);

    return {
      challenge_id: finalChallengeId,
      message: record.message,
      expires_in_sec: this.ttlSec
    };
  }

  consume(challengeId) {
    const record = this.challenges.get(challengeId);
    if (!record) {
      return null;
    }

    this.challenges.delete(challengeId);

    return record;
  }
}

module.exports = {
  ChallengeStore
};
