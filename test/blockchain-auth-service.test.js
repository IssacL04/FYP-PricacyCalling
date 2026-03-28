const test = require('node:test');
const assert = require('node:assert/strict');
const { ChallengeStore } = require('../src/auth/challenge-store');
const { BlockchainAuthService } = require('../src/auth/blockchain-auth-service');
const { verifyJwt } = require('../src/auth/jwt-utils');

function createService({ allowlisted = true } = {}) {
  const challengeStore = new ChallengeStore({ ttlSec: 60 });

  const service = new BlockchainAuthService({
    challengeStore,
    allowlistClient: {
      async isAddressAllowed() {
        return allowlisted;
      }
    },
    signatureRecoverClient: {
      async recoverAddress() {
        return '0x1111111111111111111111111111111111111111';
      }
    },
    jwtSecret: 'secret-1',
    jwtExpiresSec: 300,
    challengeTtlSec: 60,
    serverOrigin: '127.0.0.1:8080'
  });

  return { service, challengeStore };
}

test('BlockchainAuthService creates challenge and verifies signature', async () => {
  const { service } = createService({ allowlisted: true });

  const challenge = service.createChallenge({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'node-a'
  });

  assert.ok(challenge.challenge_id);
  assert.ok(challenge.message.includes('challenge_id='));

  const verified = await service.verifyChallenge({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'node-a',
    challengeId: challenge.challenge_id,
    signature: '0xdeadbeef'
  });

  assert.equal(verified.token_type, 'Bearer');
  assert.equal(verified.subject_address, '0x1111111111111111111111111111111111111111');

  const claims = verifyJwt(verified.access_token, 'secret-1');
  assert.equal(claims.sub, '0x1111111111111111111111111111111111111111');
  assert.equal(claims.auth_method, 'blockchain');
});

test('BlockchainAuthService rejects non-allowlisted address', async () => {
  const { service } = createService({ allowlisted: false });

  const challenge = service.createChallenge({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'node-a'
  });

  await assert.rejects(
    () => service.verifyChallenge({
      address: '0x1111111111111111111111111111111111111111',
      nodeId: 'node-a',
      challengeId: challenge.challenge_id,
      signature: '0xdeadbeef'
    }),
    (error) => error && error.code === 'address_not_allowlisted'
  );
});

test('BlockchainAuthService challenge can only be used once', async () => {
  const { service } = createService({ allowlisted: true });

  const challenge = service.createChallenge({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'node-a'
  });

  await service.verifyChallenge({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'node-a',
    challengeId: challenge.challenge_id,
    signature: '0xdeadbeef'
  });

  await assert.rejects(
    () => service.verifyChallenge({
      address: '0x1111111111111111111111111111111111111111',
      nodeId: 'node-a',
      challengeId: challenge.challenge_id,
      signature: '0xdeadbeef'
    }),
    (error) => error && error.code === 'challenge_invalid'
  );
});

test('BlockchainAuthService can issue demo session without signature', () => {
  const { service } = createService({ allowlisted: true });

  const issued = service.createDemoSession({
    address: '0x1111111111111111111111111111111111111111',
    nodeId: 'demo-node-1'
  });

  assert.equal(issued.token_type, 'Bearer');
  assert.equal(issued.auth_method, 'blockchain_demo');
  assert.equal(issued.subject_address, '0x1111111111111111111111111111111111111111');

  const claims = verifyJwt(issued.access_token, 'secret-1');
  assert.equal(claims.sub, '0x1111111111111111111111111111111111111111');
  assert.equal(claims.node_id, 'demo-node-1');
  assert.equal(claims.auth_method, 'blockchain_demo');
});
