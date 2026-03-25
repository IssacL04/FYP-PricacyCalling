const { AppError } = require('../utils/errors');

function binomial(n, k) {
  if (k < 0 || k > n) {
    return 0;
  }
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i += 1) {
    result *= (n - m + i) / i;
  }
  return result;
}

function privacyExhaustionProbability({ N, p, M }) {
  if (!Number.isInteger(N) || N <= 0 || !Number.isInteger(M) || M < 0) {
    throw new AppError('N and M must be valid integers', 400, 'invalid_capacity_input');
  }
  if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
    throw new AppError('p must be between 0 and 1', 400, 'invalid_capacity_input');
  }

  if (M >= N) {
    return 0;
  }

  let tail = 0;
  for (let k = M + 1; k <= N; k += 1) {
    tail += binomial(N, k) * Math.pow(p, k) * Math.pow(1 - p, N - k);
  }

  return Math.min(Math.max(tail, 0), 1);
}

module.exports = {
  privacyExhaustionProbability
};
