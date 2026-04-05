const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { loadConfig } = require('../src/config');

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }

    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toListOfInt(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  const parsed = String(value)
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  return parsed.length > 0 ? parsed : [...fallback];
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, { method = 'GET', body, headers = {}, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload && payload.error && payload.error.message
        ? payload.error.message
        : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency(items, maxParallel, worker) {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(maxParallel, items.length));
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }

      // eslint-disable-next-line no-await-in-loop
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

function parseSqliteDateToMs(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createOverviewSampler({ intervalMs, sampleFn }) {
  const summary = {
    samples: 0,
    sample_errors: 0,
    peak_active_calls: 0,
    peak_load_per_cpu_1m: 0,
    peak_heap_usage_ratio: 0,
    peak_rss_mb: 0
  };

  let stopped = false;
  let inFlight = false;
  let timer = null;

  async function tick() {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;
    try {
      const overview = await sampleFn();
      summary.samples += 1;

      const activeCalls = Number(overview && overview.metrics ? overview.metrics.active_calls : 0);
      const load = Number(overview && overview.metrics ? overview.metrics.load_per_cpu_1m : 0);
      const heap = Number(overview && overview.metrics ? overview.metrics.heap_usage_ratio : 0);
      const rss = Number(overview && overview.memory ? overview.memory.rss_mb : 0);

      summary.peak_active_calls = Math.max(summary.peak_active_calls, Number.isFinite(activeCalls) ? activeCalls : 0);
      summary.peak_load_per_cpu_1m = Math.max(summary.peak_load_per_cpu_1m, Number.isFinite(load) ? load : 0);
      summary.peak_heap_usage_ratio = Math.max(summary.peak_heap_usage_ratio, Number.isFinite(heap) ? heap : 0);
      summary.peak_rss_mb = Math.max(summary.peak_rss_mb, Number.isFinite(rss) ? rss : 0);
    } catch (error) {
      summary.sample_errors += 1;
    } finally {
      inFlight = false;
    }
  }

  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();

  return {
    async stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      while (inFlight) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(25);
      }
      return summary;
    }
  };
}

function buildCallPlans(users, plannedCalls) {
  const plans = [];
  for (let i = 0; i < plannedCalls; i += 1) {
    const caller = users[i % users.length];
    let callee = users[(i + 1) % users.length];
    if (callee.id === caller.id) {
      callee = users[(i + 2) % users.length];
    }
    plans.push({
      caller_user_id: caller.id,
      callee_e164: callee.real_e164
    });
  }
  return plans;
}

function toCsvLine(values) {
  return values
    .map((value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const raw = String(value);
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    })
    .join(',');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  const baseUrl = String(args['base-url'] || 'http://127.0.0.1:8080').replace(/\/+$/, '');
  const apiKey = String(args['api-key'] || process.env.API_KEY || 'change-me-api-key');
  const bearerToken = args['bearer-token'] ? String(args['bearer-token']) : '';
  const userSteps = toListOfInt(args['user-steps'], [20, 40, 60, 80, 100]);
  const callsPerUser = Math.max(1, toInt(args['calls-per-user'], 1));
  const maxParallel = Math.max(1, toInt(args['max-parallel'], 20));
  const callTimeoutSec = Math.max(5, toInt(args['call-timeout-sec'], 25));
  const pollIntervalMs = Math.max(200, toInt(args['poll-interval-ms'], 1000));
  const pollTimeoutMs = Math.max(3000, toInt(args['poll-timeout-ms'], 45000));
  const samplerIntervalMs = Math.max(500, toInt(args['sampler-interval-ms'], 2000));
  const cooldownMs = Math.max(0, toInt(args['cooldown-ms'], 3000));
  const httpTimeoutMs = Math.max(2000, toInt(args['http-timeout-ms'], 15000));
  const minStageDurationMs = Math.max(0, toInt(args['min-stage-duration-ms'], 10000));
  const userIdLike = String(args['user-id-like'] || '%');

  const outputPath = path.resolve(
    args.output
      ? String(args.output)
      : path.join(__dirname, '..', 'data', `capacity-trend-${Date.now()}.json`)
  );

  const dbPath = String(args['db-path'] || config.db.path);
  const db = new Database(dbPath, { readonly: true });
  const users = db.prepare(`
    SELECT id, real_e164
    FROM users
    WHERE enabled = 1
      AND id LIKE ?
    ORDER BY id
  `).all(userIdLike);
  db.close();

  const maxStep = Math.max(...userSteps);
  if (users.length < maxStep) {
    throw new Error(
      `not enough enabled users in DB (${users.length}), max step requires ${maxStep}`
    );
  }

  const authHeaders = bearerToken
    ? { authorization: `Bearer ${bearerToken}` }
    : { 'x-api-key': apiKey };

  async function api(pathname, { method = 'GET', body } = {}) {
    const headers = { ...authHeaders };
    if (body) {
      headers['content-type'] = 'application/json';
    }

    return requestJson(`${baseUrl}${pathname}`, {
      method,
      body,
      headers,
      timeoutMs: httpTimeoutMs
    });
  }

  async function pollTerminal(callId) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < pollTimeoutMs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        last = await api(`/v1/calls/${callId}`);
        if (last && (last.status === 'completed' || last.status === 'failed')) {
          return {
            state: 'done',
            call: last,
            settle_ms: Date.now() - started
          };
        }
      } catch (error) {
        // keep polling until timeout
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollIntervalMs);
    }

    return {
      state: 'timeout',
      call: last,
      settle_ms: Date.now() - started
    };
  }

  const results = [];
  for (const userCount of userSteps) {
    const stagedUsers = users.slice(0, userCount);
    const plannedCalls = Math.max(1, stagedUsers.length * callsPerUser);
    const callPlans = buildCallPlans(stagedUsers, plannedCalls);

    // eslint-disable-next-line no-console
    console.log(`Running stage: users=${userCount}, planned_calls=${plannedCalls}`);

    const stageStartedAtMs = Date.now();
    const stageStartedAt = new Date(stageStartedAtMs).toISOString();
    let overviewBefore = null;
    try {
      overviewBefore = await api('/v1/ops/overview');
    } catch (error) {
      overviewBefore = { error: error.message };
    }

    const sampler = createOverviewSampler({
      intervalMs: samplerIntervalMs,
      sampleFn: () => api('/v1/ops/overview')
    });

    const creationResults = await runWithConcurrency(callPlans, maxParallel, async (plan) => {
      const t0 = Date.now();
      try {
        const payload = await api('/v1/calls', {
          method: 'POST',
          body: {
            caller_user_id: plan.caller_user_id,
            callee_e164: plan.callee_e164,
            timeout_sec: callTimeoutSec
          }
        });
        return {
          ok: true,
          call_id: payload.call_id,
          selected_virtual_id: payload.selected_virtual_id,
          create_ms: Date.now() - t0
        };
      } catch (error) {
        return {
          ok: false,
          error: error.message,
          create_ms: Date.now() - t0
        };
      }
    });

    const createdCalls = creationResults.filter((item) => item.ok);
    const createFailures = creationResults.filter((item) => !item.ok);
    const callSettles = await runWithConcurrency(createdCalls, maxParallel, async (item) => {
      const settled = await pollTerminal(item.call_id);
      return {
        call_id: item.call_id,
        selected_virtual_id: item.selected_virtual_id,
        create_ms: item.create_ms,
        ...settled
      };
    });

    const elapsedMs = Date.now() - stageStartedAtMs;
    if (elapsedMs < minStageDurationMs) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(minStageDurationMs - elapsedMs);
    }

    const sampleSummary = await sampler.stop();

    let overviewAfter = null;
    try {
      overviewAfter = await api('/v1/ops/overview');
    } catch (error) {
      overviewAfter = { error: error.message };
    }

    const stageEndedAt = new Date().toISOString();

    const completed = callSettles.filter((item) => item.state === 'done' && item.call && item.call.status === 'completed');
    const failed = callSettles.filter((item) => item.state === 'done' && item.call && item.call.status === 'failed');
    const timedOut = callSettles.filter((item) => item.state === 'timeout');

    const createMsSeries = creationResults.map((item) => item.create_ms).filter((item) => Number.isFinite(item));
    const settleMsSeries = callSettles.map((item) => item.settle_ms).filter((item) => Number.isFinite(item));
    const lifecycleMsSeries = callSettles
      .map((item) => {
        if (!(item.state === 'done' && item.call)) {
          return null;
        }
        const createdMs = parseSqliteDateToMs(item.call.started_at || item.call.created_at);
        const endedMs = parseSqliteDateToMs(item.call.ended_at);
        if (!Number.isFinite(createdMs) || !Number.isFinite(endedMs)) {
          return null;
        }
        return Math.max(0, endedMs - createdMs);
      })
      .filter((item) => Number.isFinite(item));

    const terminalFailureReasons = {};
    failed.forEach((item) => {
      const reason = item && item.call && item.call.failure_reason
        ? String(item.call.failure_reason)
        : 'unknown';
      terminalFailureReasons[reason] = (terminalFailureReasons[reason] || 0) + 1;
    });

    const stageResult = {
      user_count: userCount,
      planned_calls: plannedCalls,
      create_success: createdCalls.length,
      create_failed: createFailures.length,
      terminal_completed: completed.length,
      terminal_failed: failed.length,
      terminal_timeout: timedOut.length,
      metrics: {
        create_p50_ms: percentile(createMsSeries, 50),
        create_p95_ms: percentile(createMsSeries, 95),
        settle_p50_ms: percentile(settleMsSeries, 50),
        settle_p95_ms: percentile(settleMsSeries, 95),
        lifecycle_p50_ms: percentile(lifecycleMsSeries, 50),
        lifecycle_p95_ms: percentile(lifecycleMsSeries, 95),
        peak_active_calls: sampleSummary.peak_active_calls,
        peak_load_per_cpu_1m: Number(sampleSummary.peak_load_per_cpu_1m.toFixed(4)),
        peak_heap_usage_ratio: Number(sampleSummary.peak_heap_usage_ratio.toFixed(4)),
        peak_rss_mb: Number(sampleSummary.peak_rss_mb.toFixed(2)),
        overview_samples: sampleSummary.samples,
        overview_sample_errors: sampleSummary.sample_errors
      },
      sample_failures: createFailures.slice(0, 10).map((item) => item.error),
      terminal_failure_reasons: terminalFailureReasons,
      stage_started_at: stageStartedAt,
      stage_ended_at: stageEndedAt,
      overview_before: overviewBefore && overviewBefore.metrics ? {
        active_calls: overviewBefore.metrics.active_calls,
        load_per_cpu_1m: overviewBefore.metrics.load_per_cpu_1m,
        heap_usage_ratio: overviewBefore.metrics.heap_usage_ratio,
        rss_mb: overviewBefore.memory ? overviewBefore.memory.rss_mb : null
      } : overviewBefore,
      overview_after: overviewAfter && overviewAfter.metrics ? {
        active_calls: overviewAfter.metrics.active_calls,
        load_per_cpu_1m: overviewAfter.metrics.load_per_cpu_1m,
        heap_usage_ratio: overviewAfter.metrics.heap_usage_ratio,
        rss_mb: overviewAfter.memory ? overviewAfter.memory.rss_mb : null
      } : overviewAfter
    };

    results.push(stageResult);

    // eslint-disable-next-line no-console
    console.log(
      `Stage done: users=${userCount}, create_ok=${stageResult.create_success}, completed=${stageResult.terminal_completed}, failed=${stageResult.terminal_failed}, timeout=${stageResult.terminal_timeout}, peak_active=${stageResult.metrics.peak_active_calls}`
    );

    if (cooldownMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(cooldownMs);
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    db_path: dbPath,
    settings: {
      user_steps: userSteps,
      user_id_like: userIdLike,
      calls_per_user: callsPerUser,
      max_parallel: maxParallel,
      call_timeout_sec: callTimeoutSec,
      poll_interval_ms: pollIntervalMs,
      poll_timeout_ms: pollTimeoutMs,
      sampler_interval_ms: samplerIntervalMs,
      cooldown_ms: cooldownMs,
      min_stage_duration_ms: minStageDurationMs
    },
    results
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const csvPath = outputPath.replace(/\.json$/i, '.csv');
  const csvRows = [
    [
      'user_count',
      'planned_calls',
      'create_success',
      'create_failed',
      'terminal_completed',
      'terminal_failed',
      'terminal_timeout',
      'create_p95_ms',
      'settle_p95_ms',
      'lifecycle_p95_ms',
      'peak_active_calls',
      'peak_load_per_cpu_1m',
      'peak_heap_usage_ratio',
      'peak_rss_mb',
      'overview_samples',
      'overview_sample_errors'
    ].join(',')
  ];

  results.forEach((stage) => {
    csvRows.push(toCsvLine([
      stage.user_count,
      stage.planned_calls,
      stage.create_success,
      stage.create_failed,
      stage.terminal_completed,
      stage.terminal_failed,
      stage.terminal_timeout,
      stage.metrics.create_p95_ms,
      stage.metrics.settle_p95_ms,
      stage.metrics.lifecycle_p95_ms,
      stage.metrics.peak_active_calls,
      stage.metrics.peak_load_per_cpu_1m,
      stage.metrics.peak_heap_usage_ratio,
      stage.metrics.peak_rss_mb,
      stage.metrics.overview_samples,
      stage.metrics.overview_sample_errors
    ]));
  });
  fs.writeFileSync(csvPath, `${csvRows.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Capacity benchmark JSON: ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`Capacity benchmark CSV: ${csvPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`benchmark failed: ${error.message}`);
  process.exit(1);
});
