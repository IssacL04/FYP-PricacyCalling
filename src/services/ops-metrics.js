function toMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function toRatio(numerator, denominator) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) {
    return 0;
  }
  return n / d;
}

function round4(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function evaluateLevel(value, warnThreshold, errorThreshold) {
  if (value >= errorThreshold) {
    return 'error';
  }
  if (value >= warnThreshold) {
    return 'warning';
  }
  return 'ok';
}

function createAlert({
  id,
  metric,
  displayName,
  value,
  warnThreshold,
  errorThreshold
}) {
  const level = evaluateLevel(value, warnThreshold, errorThreshold);
  if (level === 'ok') {
    return null;
  }

  return {
    id,
    metric,
    level,
    value,
    warn_threshold: warnThreshold,
    error_threshold: errorThreshold,
    message: `${displayName}=${value} (warn>=${warnThreshold}, error>=${errorThreshold})`
  };
}

function buildOpsMetricsAndAlerts({
  summary,
  memoryUsage,
  loadavg,
  cpuCount,
  totalMem,
  freeMem,
  thresholds
}) {
  const activeCalls = (summary && summary.calls && summary.calls.active) || 0;
  const heapUsageRatio = toRatio(
    memoryUsage && memoryUsage.heapUsed,
    memoryUsage && memoryUsage.heapTotal
  );
  const loadPerCpu1m = toRatio(loadavg && loadavg[0], cpuCount);
  const freeRatio = toRatio(freeMem, totalMem);

  const normalizedThresholds = {
    load_per_cpu_1m: {
      warn: thresholds && thresholds.loadPerCpu ? thresholds.loadPerCpu.warn : 0.8,
      error: thresholds && thresholds.loadPerCpu ? thresholds.loadPerCpu.error : 1.2
    },
    heap_usage_ratio: {
      warn: thresholds && thresholds.heapUsage ? thresholds.heapUsage.warn : 0.75,
      error: thresholds && thresholds.heapUsage ? thresholds.heapUsage.error : 0.9
    },
    active_calls: {
      warn: thresholds && thresholds.activeCalls ? thresholds.activeCalls.warn : 30,
      error: thresholds && thresholds.activeCalls ? thresholds.activeCalls.error : 50
    }
  };

  const alerts = [
    createAlert({
      id: 'load_per_cpu_1m',
      metric: 'load_per_cpu_1m',
      displayName: 'Load/Core(1m)',
      value: round4(loadPerCpu1m),
      warnThreshold: normalizedThresholds.load_per_cpu_1m.warn,
      errorThreshold: normalizedThresholds.load_per_cpu_1m.error
    }),
    createAlert({
      id: 'heap_usage_ratio',
      metric: 'heap_usage_ratio',
      displayName: 'Heap Usage',
      value: round4(heapUsageRatio),
      warnThreshold: normalizedThresholds.heap_usage_ratio.warn,
      errorThreshold: normalizedThresholds.heap_usage_ratio.error
    }),
    createAlert({
      id: 'active_calls',
      metric: 'active_calls',
      displayName: 'Active Calls',
      value: activeCalls,
      warnThreshold: normalizedThresholds.active_calls.warn,
      errorThreshold: normalizedThresholds.active_calls.error
    })
  ].filter(Boolean);

  return {
    system: {
      loadavg: {
        m1: round4(loadavg && loadavg[0]),
        m5: round4(loadavg && loadavg[1]),
        m15: round4(loadavg && loadavg[2])
      },
      cpu_count: Math.max(1, Number.parseInt(cpuCount, 10) || 1),
      memory: {
        total_mb: toMb(totalMem),
        free_mb: toMb(freeMem),
        free_ratio: round4(freeRatio)
      }
    },
    metrics: {
      active_calls: activeCalls,
      heap_usage_ratio: round4(heapUsageRatio),
      load_per_cpu_1m: round4(loadPerCpu1m)
    },
    thresholds: normalizedThresholds,
    alerts
  };
}

module.exports = {
  buildOpsMetricsAndAlerts,
  evaluateLevel
};
