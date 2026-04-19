const { engsetBlockingProbability } = require('./engset');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSeries(series) {
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error('traffic series must be a non-empty array');
  }

  return series.map((item, idx) => {
    const value = toFiniteNumber(item, NaN);
    if (!Number.isFinite(value)) {
      throw new Error(`traffic series contains non-numeric item at index ${idx}`);
    }
    return Math.max(0, value);
  });
}

function normalizeHorizons(horizons, fallback = [15, 30]) {
  const source = Array.isArray(horizons) && horizons.length ? horizons : fallback;
  const normalized = Array.from(new Set(source
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isFinite(item) && item > 0)))
    .sort((a, b) => a - b);

  return normalized.length ? normalized : [...fallback];
}

function forecastTraffic(series, horizonMin, params = {}) {
  const values = normalizeSeries(series);
  const stepMin = Math.max(0.1, toFiniteNumber(params.stepMin, 1));
  const alpha = clamp(toFiniteNumber(params.alpha, 0.42), 0.01, 0.99);
  const beta = clamp(toFiniteNumber(params.beta, 0.2), 0.01, 0.99);
  const seasonalWeight = clamp(toFiniteNumber(params.seasonalWeight, 0.22), 0, 0.95);
  const seasonLengthMin = Math.max(stepMin, toFiniteNumber(params.seasonLengthMin, 180));
  const seasonSteps = Math.max(1, Math.round(seasonLengthMin / stepMin));
  const horizonSteps = Math.max(1, Math.round(Math.max(stepMin, toFiniteNumber(horizonMin, 15)) / stepMin));

  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  const output = [];

  for (let i = 0; i < values.length; i += 1) {
    if (i > 0) {
      const prevLevel = level;
      const observed = values[i];
      level = alpha * observed + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const baseForecast = level + trend * horizonSteps;
    let blended = baseForecast;
    if (i - seasonSteps >= 0) {
      const seasonalRef = values[i - seasonSteps];
      blended = (1 - seasonalWeight) * baseForecast + seasonalWeight * seasonalRef;
    }

    output.push(Math.max(0, blended));
  }

  return output;
}

function estimateRequiredPool({
  N,
  attemptsPerMin,
  holdingMin,
  targetBlocking,
  minPool,
  maxPool
}) {
  const users = Math.max(1, Math.round(toFiniteNumber(N, 300)));
  const attempts = Math.max(0, toFiniteNumber(attemptsPerMin, 0));
  const holding = Math.max(0.01, toFiniteNumber(holdingMin, 1.5));
  const target = clamp(toFiniteNumber(targetBlocking, 0.1), 0.001, 0.999);
  const minC = Math.max(1, Math.round(toFiniteNumber(minPool, 10)));
  const maxC = Math.max(minC, Math.round(toFiniteNumber(maxPool, Math.max(minC, 60))));

  if (attempts <= 0) {
    return minC;
  }

  const beta = (attempts * holding) / users;
  for (let c = minC; c <= maxC; c += 1) {
    const pb = engsetBlockingProbability({ N: users, C: c, beta });
    if (pb <= target) {
      return c;
    }
  }

  return maxC;
}

function summarizePolicy(points, { targetBlocking }) {
  const totalAttempts = points.reduce((sum, item) => sum + item.attempts, 0);
  const totalFailures = points.reduce((sum, item) => sum + item.failures, 0);
  const totalSuccess = points.reduce((sum, item) => sum + item.successes, 0);

  return {
    total_attempts: Number(totalAttempts.toFixed(3)),
    total_failures: Number(totalFailures.toFixed(3)),
    total_successes: Number(totalSuccess.toFixed(3)),
    create_success_rate: totalAttempts > 0
      ? Number((totalSuccess / totalAttempts).toFixed(6))
      : 1,
    avg_pool: Number((points.reduce((sum, item) => sum + item.pool, 0) / points.length).toFixed(3)),
    peak_pool: Number(Math.max(...points.map((item) => item.pool)).toFixed(3)),
    avg_blocking: Number((points.reduce((sum, item) => sum + item.blocking, 0) / points.length).toFixed(6)),
    peak_blocking: Number(Math.max(...points.map((item) => item.blocking)).toFixed(6)),
    blocking_minutes: points.filter((item) => item.blocking > targetBlocking).length
  };
}

function simulatePolicies(config = {}) {
  const trafficSeries = normalizeSeries(config.trafficSeries);
  const stepMin = Math.max(0.1, toFiniteNumber(config.stepMin, 1));
  const horizons = normalizeHorizons(config.horizons, [15, 30]);
  const policyHorizonMin = Number.parseInt(config.policyHorizonMin, 10) || horizons[0];
  if (!horizons.includes(policyHorizonMin)) {
    horizons.push(policyHorizonMin);
    horizons.sort((a, b) => a - b);
  }

  const users = Math.max(1, Math.round(toFiniteNumber(config.onlineUsers, 300)));
  const holdingMin = Math.max(0.05, toFiniteNumber(config.holdingMin, 1.5));
  const targetBlocking = clamp(toFiniteNumber(config.targetBlocking, 0.1), 0.001, 0.999);
  const minPool = Math.max(1, Math.round(toFiniteNumber(config.minPool, 10)));
  const maxPool = Math.max(minPool, Math.round(toFiniteNumber(config.maxPool, 60)));
  const initialPool = clamp(
    Math.round(toFiniteNumber(config.initialPool, minPool)),
    minPool,
    maxPool
  );

  const scaleUpDelayMin = Math.max(stepMin, toFiniteNumber(config.scaleUpDelayMin, 10));
  const scaleDownDelayMin = Math.max(stepMin, toFiniteNumber(config.scaleDownDelayMin, 30));
  const scaleUpDelaySteps = Math.max(1, Math.round(scaleUpDelayMin / stepMin));
  const scaleDownDelaySteps = Math.max(1, Math.round(scaleDownDelayMin / stepMin));

  const maxStepPerAction = Math.max(1, Math.round(toFiniteNumber(config.maxStepPerAction, 8)));
  const downscaleThreshold = Math.max(1, Math.round(toFiniteNumber(config.downscaleThreshold, 2)));

  const forecasts = {};
  horizons.forEach((horizon) => {
    forecasts[horizon] = forecastTraffic(trafficSeries, horizon, {
      stepMin,
      alpha: config.alpha,
      beta: config.beta,
      seasonalWeight: config.seasonalWeight,
      seasonLengthMin: config.seasonLengthMin
    });
  });

  const requiredPoolNow = trafficSeries.map((attempts) => estimateRequiredPool({
    N: users,
    attemptsPerMin: attempts,
    holdingMin,
    targetBlocking,
    minPool,
    maxPool
  }));

  function runPolicy(mode) {
    const points = [];
    let pool = initialPool;
    let cumulativeFailures = 0;
    let pendingAction = null;

    function projectedPool() {
      return pendingAction ? pendingAction.targetPool : pool;
    }

    function scheduleAction(direction, desiredPool, stepIdx) {
      if (pendingAction && pendingAction.direction === direction) {
        return;
      }

      const projected = projectedPool();
      const boundedDesired = clamp(desiredPool, minPool, maxPool);
      let target = projected;
      let delay = scaleUpDelaySteps;

      if (direction === 'up') {
        if (boundedDesired <= projected) {
          return;
        }
        target = Math.min(boundedDesired, projected + maxStepPerAction);
        delay = scaleUpDelaySteps;
      } else {
        if (boundedDesired >= projected) {
          return;
        }
        target = Math.max(boundedDesired, projected - maxStepPerAction);
        delay = scaleDownDelaySteps;
      }

      pendingAction = {
        direction,
        applyIndex: stepIdx + delay,
        targetPool: target
      };
    }

    for (let i = 0; i < trafficSeries.length; i += 1) {
      if (pendingAction && pendingAction.applyIndex <= i) {
        pool = pendingAction.targetPool;
        pendingAction = null;
      }

      const actualAttempts = trafficSeries[i];
      const forecasted = forecasts[policyHorizonMin][i];
      const signalAttempts = mode === 'predictive'
        ? Math.max(actualAttempts, forecasted)
        : actualAttempts;

      const desiredPool = estimateRequiredPool({
        N: users,
        attemptsPerMin: signalAttempts,
        holdingMin,
        targetBlocking,
        minPool,
        maxPool
      });

      const projected = projectedPool();
      if (desiredPool > projected) {
        pendingAction = pendingAction && pendingAction.direction === 'down' ? null : pendingAction;
        scheduleAction('up', desiredPool, i);
      } else if (desiredPool < projected - downscaleThreshold) {
        pendingAction = pendingAction && pendingAction.direction === 'up' ? null : pendingAction;
        scheduleAction('down', desiredPool, i);
      }

      const beta = (actualAttempts * holdingMin) / users;
      const blocking = actualAttempts <= 0
        ? 0
        : engsetBlockingProbability({ N: users, C: pool, beta });
      const failures = actualAttempts * blocking;
      const successes = Math.max(0, actualAttempts - failures);
      cumulativeFailures += failures;

      points.push({
        minute_index: i,
        minute: Number((i * stepMin).toFixed(3)),
        attempts: Number(actualAttempts.toFixed(4)),
        signal_attempts: Number(signalAttempts.toFixed(4)),
        required_pool: requiredPoolNow[i],
        desired_pool: desiredPool,
        pool,
        blocking: Number(blocking.toFixed(6)),
        failures: Number(failures.toFixed(6)),
        successes: Number(successes.toFixed(6)),
        cumulative_failures: Number(cumulativeFailures.toFixed(6))
      });
    }

    return {
      points,
      summary: summarizePolicy(points, { targetBlocking })
    };
  }

  const reactive = runPolicy('reactive');
  const predictive = runPolicy('predictive');

  const mergedSeries = trafficSeries.map((attempts, i) => {
    const row = {
      minute_index: i,
      minute: Number((i * stepMin).toFixed(3)),
      attempts_per_min: Number(attempts.toFixed(6)),
      required_pool_now: requiredPoolNow[i],
      reactive_pool: reactive.points[i].pool,
      predictive_pool: predictive.points[i].pool,
      reactive_blocking: reactive.points[i].blocking,
      predictive_blocking: predictive.points[i].blocking,
      reactive_failures: reactive.points[i].failures,
      predictive_failures: predictive.points[i].failures,
      reactive_cumulative_failures: reactive.points[i].cumulative_failures,
      predictive_cumulative_failures: predictive.points[i].cumulative_failures
    };

    horizons.forEach((horizon) => {
      row[`forecast_attempts_h${horizon}`] = Number(forecasts[horizon][i].toFixed(6));
    });

    return row;
  });

  const reactiveFailures = reactive.summary.total_failures;
  const predictiveFailures = predictive.summary.total_failures;

  const summary = {
    generated_steps: mergedSeries.length,
    policy_horizon_min: policyHorizonMin,
    target_blocking: targetBlocking,
    reactive: reactive.summary,
    predictive: predictive.summary,
    failure_reduction_pct: reactiveFailures > 0
      ? Number((((reactiveFailures - predictiveFailures) / reactiveFailures) * 100).toFixed(4))
      : 0,
    blocking_minutes_reduction: reactive.summary.blocking_minutes - predictive.summary.blocking_minutes,
    avg_pool: {
      reactive: reactive.summary.avg_pool,
      predictive: predictive.summary.avg_pool
    },
    peak_pool: {
      reactive: reactive.summary.peak_pool,
      predictive: predictive.summary.peak_pool
    }
  };

  return {
    config: {
      step_min: stepMin,
      horizons_min: horizons,
      policy_horizon_min: policyHorizonMin,
      online_users: users,
      holding_min: holdingMin,
      target_blocking: targetBlocking,
      min_pool: minPool,
      max_pool: maxPool,
      initial_pool: initialPool,
      scale_up_delay_min: scaleUpDelayMin,
      scale_down_delay_min: scaleDownDelayMin,
      max_step_per_action: maxStepPerAction,
      downscale_threshold: downscaleThreshold
    },
    summary,
    series: mergedSeries
  };
}

module.exports = {
  forecastTraffic,
  estimateRequiredPool,
  simulatePolicies
};
