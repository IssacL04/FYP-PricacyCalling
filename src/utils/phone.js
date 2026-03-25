const { AppError } = require('./errors');

const E164_PATTERN = /^\+[1-9][0-9]{5,14}$/;

function normalizeE164(value, fieldName = 'number') {
  if (typeof value !== 'string') {
    throw new AppError(`${fieldName} must be a string`, 400, 'invalid_number');
  }

  const compact = value.trim().replace(/[\s\-()]/g, '');
  if (!E164_PATTERN.test(compact)) {
    throw new AppError(
      `${fieldName} must be E.164 format like +8613800138000`,
      400,
      'invalid_number',
      { field: fieldName }
    );
  }

  return compact;
}

module.exports = {
  normalizeE164,
  E164_PATTERN
};
