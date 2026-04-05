const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

function avg(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function configureVirtualPool({
  dbPath,
  userIdLike,
  virtualCount,
  virtualE164Like
}) {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const userRows = db.prepare(`
    SELECT id, real_e164
    FROM users
    WHERE enabled = 1 AND id LIKE ?
    ORDER BY id
  `).all(userIdLike);

  if (userRows.length === 0) {
    db.close();
    throw new Error(`no enabled users matched pattern: ${userIdLike}`);
  }

  const virtualCandidates = db.prepare(`
    SELECT id, e164
    FROM virtual_numbers
    WHERE e164 LIKE ?
    ORDER BY id
  `).all(virtualE164Like);

  if (virtualCandidates.length === 0) {
    db.close();
    throw new Error(`no virtual candidates found for pattern: ${virtualE164Like}`);
  }

  if (virtualCount > virtualCandidates.length) {
    db.close();
    throw new Error(
      `virtualCount=${virtualCount} exceeds available mapped virtuals (${virtualCandidates.length})`
    );
  }

  const selected = virtualCandidates.slice(0, virtualCount);
  const selectedIds = selected.map((item) => item.id);

  const upsertMapping = db.prepare(`
    INSERT INTO id_mappings (callee_e164, virtual_number_id, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(callee_e164) DO UPDATE SET
      virtual_number_id = excluded.virtual_number_id,
      updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    db.prepare('UPDATE virtual_numbers SET enabled = 0').run();
    const enableStmt = db.prepare('UPDATE virtual_numbers SET enabled = 1 WHERE id = ?');
    selectedIds.forEach((id) => enableStmt.run(id));

    userRows.forEach((user, idx) => {
      const virtualId = selectedIds[idx % selectedIds.length];
      upsertMapping.run(user.real_e164, virtualId);
    });
  });

  tx();
  db.close();

  return {
    selected_virtual_ids: selectedIds,
    selected_virtual_e164: selected.map((item) => item.e164),
    user_count_matched: userRows.length
  };
}

function runBenchmarkScenario({
  cwd,
  baseUrl,
  apiKey,
  bearerToken,
  userSteps,
  userIdLike,
  callsPerUser,
  maxParallel,
  callTimeoutSec,
  pollIntervalMs,
  pollTimeoutMs,
  samplerIntervalMs,
  cooldownMs,
  minStageDurationMs,
  outputPath
}) {
  const args = [
    'scripts/benchmark-capacity.js',
    '--base-url', baseUrl,
    '--user-steps', userSteps.join(','),
    '--user-id-like', userIdLike,
    '--calls-per-user', String(callsPerUser),
    '--max-parallel', String(maxParallel),
    '--call-timeout-sec', String(callTimeoutSec),
    '--poll-interval-ms', String(pollIntervalMs),
    '--poll-timeout-ms', String(pollTimeoutMs),
    '--sampler-interval-ms', String(samplerIntervalMs),
    '--cooldown-ms', String(cooldownMs),
    '--min-stage-duration-ms', String(minStageDurationMs),
    '--output', outputPath
  ];

  if (bearerToken) {
    args.push('--bearer-token', bearerToken);
  } else {
    args.push('--api-key', apiKey);
  }

  const result = spawnSync('node', args, {
    cwd,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    throw new Error(`benchmark scenario failed with exit code ${result.status}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  const cwd = path.join(__dirname, '..');
  const baseUrl = String(args['base-url'] || 'http://127.0.0.1:8080');
  const apiKey = String(args['api-key'] || process.env.API_KEY || config.app.apiKey || '');
  const bearerToken = args['bearer-token'] ? String(args['bearer-token']) : '';
  const userSteps = toListOfInt(args['user-steps'], [20, 40, 60, 80, 100]);
  const virtualCounts = toListOfInt(args['virtual-counts'], [10, 20, 30]);
  const repeats = Math.max(1, toInt(args.repeats, 2));
  const userIdLike = String(args['user-id-like'] || 'user-u%');
  const virtualE164Like = String(args['virtual-e164-like'] || '%');

  const callsPerUser = Math.max(1, toInt(args['calls-per-user'], 2));
  const maxParallel = Math.max(1, toInt(args['max-parallel'], 30));
  const callTimeoutSec = Math.max(5, toInt(args['call-timeout-sec'], 25));
  const pollIntervalMs = Math.max(200, toInt(args['poll-interval-ms'], 1000));
  const pollTimeoutMs = Math.max(3000, toInt(args['poll-timeout-ms'], 45000));
  const samplerIntervalMs = Math.max(500, toInt(args['sampler-interval-ms'], 2000));
  const cooldownMs = Math.max(0, toInt(args['cooldown-ms'], 2000));
  const minStageDurationMs = Math.max(0, toInt(args['min-stage-duration-ms'], 12000));
  const dbPath = String(args['db-path'] || config.db.path);

  const outputDir = path.resolve(
    String(args['output-dir'] || path.join(cwd, 'data', `matrix-${Date.now()}`))
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const rawRuns = [];
  const flatRows = [];

  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const virtualCount of virtualCounts) {
      const virtualInfo = configureVirtualPool({
        dbPath,
        userIdLike,
        virtualCount,
        virtualE164Like
      });

      const benchOutputPath = path.join(outputDir, `bench-v${virtualCount}-r${repeat}.json`);
      // eslint-disable-next-line no-console
      console.log(
        `\n=== Matrix run: repeat=${repeat}, virtual_count=${virtualCount}, user_steps=${userSteps.join(',')} ===`
      );

      runBenchmarkScenario({
        cwd,
        baseUrl,
        apiKey,
        bearerToken,
        userSteps,
        userIdLike,
        callsPerUser,
        maxParallel,
        callTimeoutSec,
        pollIntervalMs,
        pollTimeoutMs,
        samplerIntervalMs,
        cooldownMs,
        minStageDurationMs,
        outputPath: benchOutputPath
      });

      const benchResult = JSON.parse(fs.readFileSync(benchOutputPath, 'utf8'));
      rawRuns.push({
        repeat,
        virtual_count: virtualCount,
        selected_virtual_e164: virtualInfo.selected_virtual_e164,
        benchmark: benchResult
      });

      (benchResult.results || []).forEach((stage) => {
        const createTotal = Number(stage.create_success || 0) + Number(stage.create_failed || 0);
        const terminalTotal = Number(stage.terminal_completed || 0)
          + Number(stage.terminal_failed || 0)
          + Number(stage.terminal_timeout || 0);

        flatRows.push({
          repeat,
          virtual_count: virtualCount,
          user_count: Number(stage.user_count || 0),
          planned_calls: Number(stage.planned_calls || 0),
          create_success: Number(stage.create_success || 0),
          create_failed: Number(stage.create_failed || 0),
          terminal_completed: Number(stage.terminal_completed || 0),
          terminal_failed: Number(stage.terminal_failed || 0),
          terminal_timeout: Number(stage.terminal_timeout || 0),
          create_success_rate: createTotal > 0
            ? Number(stage.create_success || 0) / createTotal
            : 0,
          terminal_completed_rate: terminalTotal > 0
            ? Number(stage.terminal_completed || 0) / terminalTotal
            : 0,
          create_p95_ms: Number(stage.metrics && stage.metrics.create_p95_ms || 0),
          settle_p95_ms: Number(stage.metrics && stage.metrics.settle_p95_ms || 0),
          lifecycle_p95_ms: Number(stage.metrics && stage.metrics.lifecycle_p95_ms || 0),
          peak_active_calls: Number(stage.metrics && stage.metrics.peak_active_calls || 0),
          peak_load_per_cpu_1m: Number(stage.metrics && stage.metrics.peak_load_per_cpu_1m || 0),
          peak_heap_usage_ratio: Number(stage.metrics && stage.metrics.peak_heap_usage_ratio || 0),
          peak_rss_mb: Number(stage.metrics && stage.metrics.peak_rss_mb || 0),
          overview_samples: Number(stage.metrics && stage.metrics.overview_samples || 0),
          overview_sample_errors: Number(stage.metrics && stage.metrics.overview_sample_errors || 0)
        });
      });
    }
  }

  const aggregateMap = new Map();
  flatRows.forEach((row) => {
    const key = `${row.virtual_count}|${row.user_count}`;
    if (!aggregateMap.has(key)) {
      aggregateMap.set(key, []);
    }
    aggregateMap.get(key).push(row);
  });

  const aggregateRows = [];
  for (const [key, rows] of aggregateMap.entries()) {
    const [virtualCountRaw, userCountRaw] = key.split('|');
    aggregateRows.push({
      virtual_count: Number(virtualCountRaw),
      user_count: Number(userCountRaw),
      repeats: rows.length,
      planned_calls_mean: round(avg(rows.map((item) => item.planned_calls)), 2),
      create_success_rate_mean: round(avg(rows.map((item) => item.create_success_rate)), 4),
      terminal_completed_rate_mean: round(avg(rows.map((item) => item.terminal_completed_rate)), 4),
      create_p95_ms_mean: round(avg(rows.map((item) => item.create_p95_ms)), 2),
      settle_p95_ms_mean: round(avg(rows.map((item) => item.settle_p95_ms)), 2),
      lifecycle_p95_ms_mean: round(avg(rows.map((item) => item.lifecycle_p95_ms)), 2),
      peak_active_calls_mean: round(avg(rows.map((item) => item.peak_active_calls)), 2),
      peak_load_per_cpu_1m_mean: round(avg(rows.map((item) => item.peak_load_per_cpu_1m)), 4),
      peak_heap_usage_ratio_mean: round(avg(rows.map((item) => item.peak_heap_usage_ratio)), 4),
      peak_rss_mb_mean: round(avg(rows.map((item) => item.peak_rss_mb)), 2)
    });
  }

  aggregateRows.sort((a, b) => {
    if (a.virtual_count !== b.virtual_count) {
      return a.virtual_count - b.virtual_count;
    }
    return a.user_count - b.user_count;
  });

  const matrixRunsPath = path.join(outputDir, 'matrix-runs.json');
  const matrixRowsPath = path.join(outputDir, 'matrix-rows.csv');
  const matrixAggregatePath = path.join(outputDir, 'matrix-aggregate.json');
  const matrixAggregateCsvPath = path.join(outputDir, 'matrix-aggregate.csv');

  fs.writeFileSync(matrixRunsPath, `${JSON.stringify(rawRuns, null, 2)}\n`, 'utf8');

  const rowCsv = [
    [
      'repeat',
      'virtual_count',
      'user_count',
      'planned_calls',
      'create_success',
      'create_failed',
      'terminal_completed',
      'terminal_failed',
      'terminal_timeout',
      'create_success_rate',
      'terminal_completed_rate',
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
  flatRows.forEach((row) => {
    rowCsv.push(toCsvLine([
      row.repeat,
      row.virtual_count,
      row.user_count,
      row.planned_calls,
      row.create_success,
      row.create_failed,
      row.terminal_completed,
      row.terminal_failed,
      row.terminal_timeout,
      row.create_success_rate,
      row.terminal_completed_rate,
      row.create_p95_ms,
      row.settle_p95_ms,
      row.lifecycle_p95_ms,
      row.peak_active_calls,
      row.peak_load_per_cpu_1m,
      row.peak_heap_usage_ratio,
      row.peak_rss_mb,
      row.overview_samples,
      row.overview_sample_errors
    ]));
  });
  fs.writeFileSync(matrixRowsPath, `${rowCsv.join('\n')}\n`, 'utf8');

  fs.writeFileSync(matrixAggregatePath, `${JSON.stringify(aggregateRows, null, 2)}\n`, 'utf8');

  const aggCsv = [
    [
      'virtual_count',
      'user_count',
      'repeats',
      'planned_calls_mean',
      'create_success_rate_mean',
      'terminal_completed_rate_mean',
      'create_p95_ms_mean',
      'settle_p95_ms_mean',
      'lifecycle_p95_ms_mean',
      'peak_active_calls_mean',
      'peak_load_per_cpu_1m_mean',
      'peak_heap_usage_ratio_mean',
      'peak_rss_mb_mean'
    ].join(',')
  ];
  aggregateRows.forEach((row) => {
    aggCsv.push(toCsvLine([
      row.virtual_count,
      row.user_count,
      row.repeats,
      row.planned_calls_mean,
      row.create_success_rate_mean,
      row.terminal_completed_rate_mean,
      row.create_p95_ms_mean,
      row.settle_p95_ms_mean,
      row.lifecycle_p95_ms_mean,
      row.peak_active_calls_mean,
      row.peak_load_per_cpu_1m_mean,
      row.peak_heap_usage_ratio_mean,
      row.peak_rss_mb_mean
    ]));
  });
  fs.writeFileSync(matrixAggregateCsvPath, `${aggCsv.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log('\nMatrix benchmark finished.');
  // eslint-disable-next-line no-console
  console.log(`  output_dir: ${outputDir}`);
  // eslint-disable-next-line no-console
  console.log(`  raw_runs: ${matrixRunsPath}`);
  // eslint-disable-next-line no-console
  console.log(`  rows_csv: ${matrixRowsPath}`);
  // eslint-disable-next-line no-console
  console.log(`  aggregate_json: ${matrixAggregatePath}`);
  // eslint-disable-next-line no-console
  console.log(`  aggregate_csv: ${matrixAggregateCsvPath}`);
}

main();
