const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeE164 } = require('../src/utils/phone');

test('normalizeE164 accepts valid number', () => {
  assert.equal(normalizeE164('+86 138-0013-8000'), '+8613800138000');
});

test('normalizeE164 rejects invalid number', () => {
  assert.throws(() => normalizeE164('13800138000'), /E\.164/);
});
