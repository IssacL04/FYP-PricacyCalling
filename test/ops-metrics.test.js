const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOpsMetricsAndAlerts, evaluateLevel } = require('../src/services/ops-metrics');

test('evaluateLevel classifies ok/warning/error', () => {
  assert.equal(evaluateLevel(0.2, 0.5, 0.8), 'ok');
  assert.equal(evaluateLevel(0.6, 0.5, 0.8), 'warning');
  assert.equal(evaluateLevel(0.8, 0.5, 0.8), 'error');
});

test('buildOpsMetricsAndAlerts returns metrics and threshold-based alerts', () => {
  const payload = buildOpsMetricsAndAlerts({
    summary: {
      calls: {
        active: 45
      }
    },
    memoryUsage: {
      heapUsed: 90,
      heapTotal: 100
    },
    loadavg: [3.2, 2.4, 1.8],
    cpuCount: 4,
    totalMem: 1024 * 1024 * 1024,
    freeMem: 256 * 1024 * 1024,
    thresholds: {
      loadPerCpu: {
        warn: 0.7,
        error: 0.9
      },
      heapUsage: {
        warn: 0.75,
        error: 0.85
      },
      activeCalls: {
        warn: 30,
        error: 50
      }
    }
  });

  assert.equal(payload.system.cpu_count, 4);
  assert.equal(payload.metrics.active_calls, 45);
  assert.equal(payload.metrics.heap_usage_ratio, 0.9);
  assert.equal(payload.metrics.load_per_cpu_1m, 0.8);

  assert.equal(payload.alerts.length, 3);
  assert.equal(payload.alerts[0].metric, 'load_per_cpu_1m');
  assert.equal(payload.alerts[0].level, 'warning');
  assert.equal(payload.alerts[1].metric, 'heap_usage_ratio');
  assert.equal(payload.alerts[1].level, 'error');
  assert.equal(payload.alerts[2].metric, 'active_calls');
  assert.equal(payload.alerts[2].level, 'warning');
});
