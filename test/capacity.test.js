const test = require('node:test');
const assert = require('node:assert/strict');
const { engsetBlockingProbability } = require('../src/capacity/engset');
const { privacyExhaustionProbability } = require('../src/capacity/privacy');

test('engsetBlockingProbability returns bounded value', () => {
  const value = engsetBlockingProbability({ N: 20, C: 10, beta: 0.2 });
  assert.equal(value >= 0 && value <= 1, true);
});

test('privacyExhaustionProbability returns expected edge cases', () => {
  assert.equal(privacyExhaustionProbability({ N: 10, p: 0.5, M: 10 }), 0);
  const value = privacyExhaustionProbability({ N: 10, p: 0.4, M: 2 });
  assert.equal(value > 0, true);
});
