const fs = require('fs');
const path = require('path');
const {
  simulatePolicies
} = require('../src/capacity/predictive-scaling');

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

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function createSeededRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function gaussianNoise(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tidalTraffic({
  durationMin,
  stepMin,
  baseline,
  amplitude,
  peakAmp,
  peakWidthMin,
  noiseSigma,
  periodMin,
  seed
}) {
  const steps = Math.max(1, Math.round(durationMin / stepMin));
  const rng = createSeededRng(seed);
  const values = [];

  const gaussian = (x, center, sigma) => Math.exp(-((x - center) ** 2) / (2 * sigma ** 2));
  const peak1 = durationMin * 0.35;
  const peak2 = durationMin * 0.78;

  for (let i = 0; i < steps; i += 1) {
    const minute = i * stepMin;
    const wave = Math.sin((2 * Math.PI * minute) / periodMin);
    const envelope = 1 + 0.35 * Math.sin((2 * Math.PI * minute) / (periodMin * 2));

    const tidal = baseline + amplitude * (1 + wave) * envelope * 0.5;
    const spikes = peakAmp * (
      gaussian(minute, peak1, peakWidthMin)
      + 0.9 * gaussian(minute, peak2, peakWidthMin * 1.1)
    );

    const noise = gaussianNoise(rng) * noiseSigma;
    const value = Math.max(0, tidal + spikes + noise);
    values.push(Number(value.toFixed(6)));
  }

  return values;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const durationMin = Math.max(60, toInt(args['duration-min'], 360));
  const stepMin = Math.max(0.5, toNumber(args['step-min'], 1));
  const horizons = String(args.horizons || '15,30')
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);

  const onlineUsers = Math.max(50, toInt(args['online-users'], 300));
  const holdingMin = Math.max(0.2, toNumber(args['holding-min'], 1.5));
  const targetBlocking = Math.min(0.8, Math.max(0.01, toNumber(args['target-blocking'], 0.1)));
  const minPool = Math.max(1, toInt(args['min-pool'], 10));
  const maxPool = Math.max(minPool, toInt(args['max-pool'], 60));
  const initialPool = Math.min(maxPool, Math.max(minPool, toInt(args['initial-pool'], minPool)));

  const scaleUpDelayMin = Math.max(stepMin, toNumber(args['scale-up-delay-min'], 10));
  const scaleDownDelayMin = Math.max(stepMin, toNumber(args['scale-down-delay-min'], 30));
  const maxStepPerAction = Math.max(1, toInt(args['max-step-per-action'], 8));
  const downscaleThreshold = Math.max(1, toInt(args['downscale-threshold'], 2));
  const policyHorizonMin = toInt(args['policy-horizon-min'], horizons[0] || 15);

  const seed = toInt(args.seed, 42);

  const baseline = Math.max(1, toNumber(args['baseline-attempts'], 6));
  const amplitude = Math.max(0, toNumber(args['tidal-amplitude'], 14));
  const peakAmp = Math.max(0, toNumber(args['peak-amplitude'], 16));
  const peakWidthMin = Math.max(stepMin, toNumber(args['peak-width-min'], 22));
  const noiseSigma = Math.max(0, toNumber(args['noise-sigma'], 0.9));
  const periodMin = Math.max(30, toNumber(args['period-min'], 180));

  const trafficSeries = tidalTraffic({
    durationMin,
    stepMin,
    baseline,
    amplitude,
    peakAmp,
    peakWidthMin,
    noiseSigma,
    periodMin,
    seed
  });

  const simulation = simulatePolicies({
    trafficSeries,
    stepMin,
    horizons,
    policyHorizonMin,
    onlineUsers,
    holdingMin,
    targetBlocking,
    minPool,
    maxPool,
    initialPool,
    scaleUpDelayMin,
    scaleDownDelayMin,
    maxStepPerAction,
    downscaleThreshold,
    alpha: toNumber(args.alpha, 0.42),
    beta: toNumber(args.beta, 0.2),
    seasonalWeight: toNumber(args['seasonal-weight'], 0.22),
    seasonLengthMin: toNumber(args['season-length-min'], 180)
  });

  const outputDir = path.resolve(
    String(args['output-dir'] || path.join(__dirname, '..', 'data', `predictive-${Date.now()}`))
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const seriesJsonPath = path.join(outputDir, 'series.json');
  const summaryPath = path.join(outputDir, 'summary.json');
  const seriesCsvPath = path.join(outputDir, 'series.csv');

  const payload = {
    generated_at: new Date().toISOString(),
    source: 'scripts/simulate-predictive-scaling.js',
    input: {
      duration_min: durationMin,
      step_min: stepMin,
      horizons,
      policy_horizon_min: policyHorizonMin,
      online_users: onlineUsers,
      holding_min: holdingMin,
      target_blocking: targetBlocking,
      min_pool: minPool,
      max_pool: maxPool,
      initial_pool: initialPool,
      scale_up_delay_min: scaleUpDelayMin,
      scale_down_delay_min: scaleDownDelayMin,
      max_step_per_action: maxStepPerAction,
      downscale_threshold: downscaleThreshold,
      seed,
      traffic: {
        baseline_attempts: baseline,
        tidal_amplitude: amplitude,
        peak_amplitude: peakAmp,
        peak_width_min: peakWidthMin,
        noise_sigma: noiseSigma,
        period_min: periodMin
      }
    },
    simulation
  };

  fs.writeFileSync(seriesJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    generated_at: payload.generated_at,
    input: payload.input,
    config: simulation.config,
    reactive: simulation.summary.reactive,
    predictive: simulation.summary.predictive,
    failure_reduction_pct: simulation.summary.failure_reduction_pct,
    blocking_minutes_reduction: simulation.summary.blocking_minutes_reduction,
    avg_pool: simulation.summary.avg_pool,
    peak_pool: simulation.summary.peak_pool
  }, null, 2)}\n`, 'utf8');

  const headers = Object.keys(simulation.series[0] || {});
  const csvLines = [toCsvLine(headers)];
  simulation.series.forEach((row) => {
    csvLines.push(toCsvLine(headers.map((h) => row[h])));
  });
  fs.writeFileSync(seriesCsvPath, `${csvLines.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log('Predictive scaling simulation finished.');
  // eslint-disable-next-line no-console
  console.log(`  output_dir: ${outputDir}`);
  // eslint-disable-next-line no-console
  console.log(`  series_json: ${seriesJsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`  series_csv: ${seriesCsvPath}`);
  // eslint-disable-next-line no-console
  console.log(`  summary_json: ${summaryPath}`);
}

main();
