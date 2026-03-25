const { AppError } = require('../utils/errors');

function combRatio(n, k) {
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

function engsetBlockingProbability({ N, C, beta }) {
  if (!Number.isInteger(N) || !Number.isInteger(C) || N <= 0 || C < 0) {
    throw new AppError('N and C must be positive integers', 400, 'invalid_capacity_input');
  }
  if (C > N) {
    throw new AppError('C must be less than or equal to N', 400, 'invalid_capacity_input');
  }
  if (typeof beta !== 'number' || !Number.isFinite(beta) || beta < 0) {
    throw new AppError('beta must be a non-negative number', 400, 'invalid_capacity_input');
  }

  let denom = 0;
  for (let k = 0; k <= C; k += 1) {
    denom += combRatio(N, k) * Math.pow(beta, k);
  }

  const numerator = combRatio(N, C) * Math.pow(beta, C);
  return denom === 0 ? 0 : numerator / denom;
}

module.exports = {
  engsetBlockingProbability
};
