const test = require('node:test');
const assert = require('node:assert/strict');
const {
  forecastTraffic,
  estimateRequiredPool,
  simulatePolicies
} = require('../src/capacity/predictive-scaling');

function buildSyntheticSeries(length) {
  const values = [];
  for (let i = 0; i < length; i += 1) {
    const trend = 5 + i * 0.08;
    const wave = 2.5 * Math.sin((2 * Math.PI * i) / 40);
    values.push(Math.max(0, trend + wave));
  }
  return values;
}

test('forecastTraffic returns finite values and same length', () => {
  const series = buildSyntheticSeries(180);
  const h15 = forecastTraffic(series, 15, { stepMin: 1 });
  const h30 = forecastTraffic(series, 30, { stepMin: 1 });

  assert.equal(h15.length, series.length);
  assert.equal(h30.length, series.length);
  assert.equal(h15.every((item) => Number.isFinite(item) && item >= 0), true);
  assert.equal(h30.every((item) => Number.isFinite(item) && item >= 0), true);
});

test('estimateRequiredPool is non-decreasing when attempts increase', () => {
  const attempts = [4, 6, 8, 10, 12, 14, 16, 18, 20];
  const pools = attempts.map((value) => estimateRequiredPool({
    N: 300,
    attemptsPerMin: value,
    holdingMin: 1.5,
    targetBlocking: 0.1,
    minPool: 10,
    maxPool: 60
  }));

  for (let i = 1; i < pools.length; i += 1) {
    assert.equal(pools[i] >= pools[i - 1], true);
  }
});

test('predictive policy produces fewer failures than reactive under fixed synthetic tidal load', () => {
  const trafficSeries = [];
  for (let i = 0; i < 360; i += 1) {
    const minute = i;
    const base = 6 + 8 * (1 + Math.sin((2 * Math.PI * minute) / 180)) * 0.5;
    const bump = 15 * Math.exp(-((minute - 126) ** 2) / (2 * 18 ** 2))
      + 13 * Math.exp(-((minute - 288) ** 2) / (2 * 24 ** 2));
    trafficSeries.push(Number((base + bump).toFixed(6)));
  }

  const output = simulatePolicies({
    trafficSeries,
    stepMin: 1,
    horizons: [15, 30],
    policyHorizonMin: 15,
    onlineUsers: 300,
    holdingMin: 1.5,
    targetBlocking: 0.1,
    minPool: 10,
    maxPool: 60,
    initialPool: 10,
    scaleUpDelayMin: 10,
    scaleDownDelayMin: 30,
    maxStepPerAction: 8,
    downscaleThreshold: 2,
    alpha: 0.42,
    beta: 0.2,
    seasonalWeight: 0.22,
    seasonLengthMin: 180
  });

  assert.equal(output.series.length, 360);
  assert.equal(output.summary.predictive.total_failures < output.summary.reactive.total_failures, true);
  assert.equal(output.summary.predictive.create_success_rate >= output.summary.reactive.create_success_rate, true);
});
