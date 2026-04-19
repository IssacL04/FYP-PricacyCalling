const fs = require('fs');
const path = require('path');

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

function listPredictiveDirs(dataDir) {
  if (!fs.existsSync(dataDir)) {
    return [];
  }

  return fs.readdirSync(dataDir)
    .filter((name) => /^predictive-\d+$/.test(name))
    .map((name) => path.join(dataDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function pickSeriesJsonPath(projectRoot, cliPath) {
  if (cliPath) {
    return path.resolve(cliPath);
  }

  const dataDir = path.join(projectRoot, 'data');
  const dirs = listPredictiveDirs(dataDir);
  for (const dir of dirs) {
    const candidate = path.join(dir, 'series.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('cannot find predictive series.json, pass --series-json');
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function createLineChartSvg({
  title,
  subtitle,
  xLabel,
  yLabel,
  xMin,
  xMax,
  yMin,
  yMax,
  xTicks,
  yTicks,
  series,
  legendTitle
}) {
  const width = 1080;
  const height = 610;
  const margin = { top: 72, right: 220, bottom: 72, left: 96 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  function xMap(value) {
    if (xMax === xMin) {
      return margin.left + plotW / 2;
    }
    return margin.left + ((value - xMin) / (xMax - xMin)) * plotW;
  }

  function yMap(value) {
    if (yMax === yMin) {
      return margin.top + plotH / 2;
    }
    return margin.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;
  }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push('<rect x="0" y="0" width="100%" height="56" fill="#eef6ff"/>');
  parts.push(`<text x="${margin.left}" y="34" font-size="24" font-family="Arial, sans-serif" fill="#1b2a41">${title}</text>`);
  if (subtitle) {
    parts.push(`<text x="${margin.left}" y="54" font-size="13" font-family="Arial, sans-serif" fill="#415a77">${subtitle}</text>`);
  }

  for (let i = 0; i <= yTicks; i += 1) {
    const ratio = i / yTicks;
    const y = margin.top + ratio * plotH;
    const value = yMax - ratio * (yMax - yMin);
    parts.push(`<line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(margin.left + plotW).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e5e9f0" stroke-width="1"/>`);
    parts.push(`<text x="${(margin.left - 12).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${value.toFixed(3)}</text>`);
  }

  xTicks.forEach((tick) => {
    const x = xMap(tick);
    parts.push(`<line x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${(margin.top + plotH).toFixed(2)}" stroke="#f1f3f8" stroke-width="1"/>`);
    parts.push(`<text x="${x.toFixed(2)}" y="${(margin.top + plotH + 22).toFixed(2)}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${tick}</text>`);
  });

  parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotH).toFixed(2)}" x2="${(margin.left + plotW).toFixed(2)}" y2="${(margin.top + plotH).toFixed(2)}" stroke="#2e3440" stroke-width="1.5"/>`);
  parts.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(margin.top + plotH).toFixed(2)}" stroke="#2e3440" stroke-width="1.5"/>`);

  parts.push(`<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(height - 20).toFixed(2)}" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" fill="#2e3440">${xLabel}</text>`);
  parts.push(`<text x="20" y="${(margin.top + plotH / 2).toFixed(2)}" transform="rotate(-90 20 ${(margin.top + plotH / 2).toFixed(2)})" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" fill="#2e3440">${yLabel}</text>`);

  series.forEach((line) => {
    const validPoints = (line.points || [])
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .sort((a, b) => a.x - b.x);

    if (!validPoints.length) {
      return;
    }

    if (line.dashed) {
      const polylineDashed = validPoints
        .map((point) => `${xMap(point.x).toFixed(2)},${yMap(point.y).toFixed(2)}`)
        .join(' ');
      parts.push(`<polyline points="${polylineDashed}" fill="none" stroke="${line.color}" stroke-width="2" stroke-dasharray="6 4"/>`);
    } else {
      const polyline = validPoints
        .map((point) => `${xMap(point.x).toFixed(2)},${yMap(point.y).toFixed(2)}`)
        .join(' ');
      parts.push(`<polyline points="${polyline}" fill="none" stroke="${line.color}" stroke-width="2.8"/>`);
      validPoints.forEach((point, idx) => {
        if (idx % 8 === 0 || idx === validPoints.length - 1) {
          parts.push(`<circle cx="${xMap(point.x).toFixed(2)}" cy="${yMap(point.y).toFixed(2)}" r="3.2" fill="${line.color}"/>`);
        }
      });
    }
  });

  const legendX = margin.left + plotW + 18;
  let legendY = margin.top + 12;
  if (legendTitle) {
    parts.push(`<text x="${legendX}" y="${legendY - 6}" font-size="12" font-family="Arial, sans-serif" fill="#1f2937">${legendTitle}</text>`);
  }
  series.forEach((line) => {
    parts.push(`<line x1="${legendX}" y1="${legendY}" x2="${legendX + 22}" y2="${legendY}" stroke="${line.color}" stroke-width="${line.dashed ? 2 : 3}" ${line.dashed ? 'stroke-dasharray="6 4"' : ''}/>`);
    parts.push(`<text x="${legendX + 30}" y="${legendY + 4}" font-size="12" font-family="Arial, sans-serif" fill="#2e3440">${line.name}</text>`);
    legendY += 22;
  });

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function writeLineChart({
  rows,
  outputPath,
  title,
  subtitle,
  yLabel,
  lines,
  yMinMode = 'auto'
}) {
  const xValues = rows.map((row) => toNumber(row.minute)).filter((v) => v !== null);
  const series = lines.map((line) => ({
    name: line.name,
    color: line.color,
    dashed: Boolean(line.dashed),
    points: rows
      .map((row) => ({ x: toNumber(row.minute), y: toNumber(row[line.field]) }))
      .filter((item) => item.x !== null && item.y !== null)
  }));

  const yValues = series.flatMap((line) => line.points.map((point) => point.y));
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);

  if (yMinMode === 'zero') {
    yMin = 0;
    yMax = Math.max(0.001, yMax);
  } else {
    const span = Math.max(0.001, yMax - yMin);
    yMin = Math.max(0, yMin - span * 0.1);
    yMax += span * 0.14;
  }

  const maxTickCount = 8;
  const tickStep = Math.max(1, Math.ceil(rows.length / maxTickCount));
  const xTicks = rows
    .filter((_, idx) => idx % tickStep === 0)
    .map((row) => Number(toNumber(row.minute).toFixed(0)));
  if (xTicks[xTicks.length - 1] !== Number(xMax.toFixed(0))) {
    xTicks.push(Number(xMax.toFixed(0)));
  }

  const svg = createLineChartSvg({
    title,
    subtitle,
    xLabel: 'Minute',
    yLabel,
    xMin,
    xMax,
    yMin,
    yMax,
    xTicks,
    yTicks: 5,
    series,
    legendTitle: 'Series'
  });

  fs.writeFileSync(outputPath, svg, 'utf8');
}

function buildSummaryMarkdown({ summaryPath, summary, sourcePath }) {
  const lines = [];
  lines.push('# Predictive Scaling PoC Summary');
  lines.push('');
  lines.push(`Source: \`${sourcePath}\``);
  lines.push('');
  lines.push('| Metric | Reactive | Predictive |');
  lines.push('|---|---:|---:|');
  lines.push(`| Create success rate | ${summary.reactive.create_success_rate.toFixed(4)} | ${summary.predictive.create_success_rate.toFixed(4)} |`);
  lines.push(`| Total failures | ${summary.reactive.total_failures.toFixed(2)} | ${summary.predictive.total_failures.toFixed(2)} |`);
  lines.push(`| Avg pool | ${summary.reactive.avg_pool.toFixed(2)} | ${summary.predictive.avg_pool.toFixed(2)} |`);
  lines.push(`| Peak pool | ${summary.reactive.peak_pool.toFixed(2)} | ${summary.predictive.peak_pool.toFixed(2)} |`);
  lines.push(`| Blocking minutes (>target) | ${summary.reactive.blocking_minutes} | ${summary.predictive.blocking_minutes} |`);
  lines.push('');
  lines.push('## KPI');
  lines.push('');
  lines.push(`- Failure reduction: **${summary.failure_reduction_pct.toFixed(2)}%**`);
  lines.push(`- Blocking-minute reduction: **${summary.blocking_minutes_reduction}**`);
  lines.push('');

  fs.writeFileSync(summaryPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.join(__dirname, '..');

  const seriesJsonPath = pickSeriesJsonPath(projectRoot, args['series-json']);
  const payload = JSON.parse(fs.readFileSync(seriesJsonPath, 'utf8'));

  if (!payload || !payload.simulation || !Array.isArray(payload.simulation.series)) {
    throw new Error(`invalid simulation payload at ${seriesJsonPath}`);
  }

  const rows = payload.simulation.series;
  const summary = payload.simulation.summary;
  const outputDir = path.resolve(
    String(args['output-dir'] || path.join(path.dirname(seriesJsonPath), 'charts'))
  );
  fs.mkdirSync(outputDir, { recursive: true });

  writeLineChart({
    rows,
    outputPath: path.join(outputDir, '01-traffic-forecast.svg'),
    title: 'Traffic vs Forecast (15/30 min Horizon)',
    subtitle: 'Actual tidal traffic and Holt/EWMA forecasts',
    yLabel: 'Attempts per Minute',
    lines: [
      { name: 'actual attempts', field: 'attempts_per_min', color: '#1f77b4' },
      { name: 'forecast h15', field: 'forecast_attempts_h15', color: '#ff7f0e', dashed: true },
      { name: 'forecast h30', field: 'forecast_attempts_h30', color: '#2ca02c', dashed: true }
    ].filter((line) => rows.some((row) => Number.isFinite(Number(row[line.field]))))
  });

  writeLineChart({
    rows,
    outputPath: path.join(outputDir, '02-pool-scaling-compare.svg'),
    title: 'Virtual Pool Scaling: Reactive vs Predictive',
    subtitle: 'Predictive policy pre-warms pool before traffic peaks',
    yLabel: 'Virtual Pool Count',
    lines: [
      { name: 'required now', field: 'required_pool_now', color: '#a3a3a3', dashed: true },
      { name: 'reactive pool', field: 'reactive_pool', color: '#d62728' },
      { name: 'predictive pool', field: 'predictive_pool', color: '#2ca02c' }
    ],
    yMinMode: 'zero'
  });

  writeLineChart({
    rows,
    outputPath: path.join(outputDir, '03-blocking-compare.svg'),
    title: 'Blocking Probability Comparison',
    subtitle: 'Predictive scaling lowers peak blocking during tidal surges',
    yLabel: 'Blocking Probability',
    lines: [
      { name: 'reactive blocking', field: 'reactive_blocking', color: '#d62728' },
      { name: 'predictive blocking', field: 'predictive_blocking', color: '#2ca02c' }
    ],
    yMinMode: 'zero'
  });

  writeLineChart({
    rows,
    outputPath: path.join(outputDir, '04-cumulative-failures.svg'),
    title: 'Cumulative Create Failures',
    subtitle: 'Total expected create-stage failures over the simulation window',
    yLabel: 'Cumulative Failures',
    lines: [
      { name: 'reactive cumulative', field: 'reactive_cumulative_failures', color: '#d62728' },
      { name: 'predictive cumulative', field: 'predictive_cumulative_failures', color: '#2ca02c' }
    ],
    yMinMode: 'zero'
  });

  const summaryMdPath = path.join(outputDir, 'summary.md');
  buildSummaryMarkdown({
    summaryPath: summaryMdPath,
    summary,
    sourcePath: seriesJsonPath
  });

  const indexPath = path.join(outputDir, 'index.html');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Predictive Scaling Charts</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1b2a41; background: #f6f9fc; }
    h1 { margin-bottom: 8px; }
    .meta { color: #415a77; margin-bottom: 20px; }
    .card { background: #fff; border: 1px solid #d9e2ec; border-radius: 10px; padding: 12px; margin-bottom: 18px; }
    img { width: 100%; max-width: 1080px; display: block; border: 1px solid #eef2f7; border-radius: 8px; }
    .kpi { font-size: 15px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Predictive Scaling PoC Charts</h1>
  <div class="meta">series source: ${seriesJsonPath}</div>
  <div class="card kpi">
    <div>Reactive create success rate: <b>${summary.reactive.create_success_rate.toFixed(4)}</b></div>
    <div>Predictive create success rate: <b>${summary.predictive.create_success_rate.toFixed(4)}</b></div>
    <div>Failure reduction: <b>${summary.failure_reduction_pct.toFixed(2)}%</b></div>
    <div>Blocking-minute reduction: <b>${summary.blocking_minutes_reduction}</b></div>
  </div>
  <div class="card"><img src="./01-traffic-forecast.svg" alt="traffic forecast"></div>
  <div class="card"><img src="./02-pool-scaling-compare.svg" alt="pool scaling"></div>
  <div class="card"><img src="./03-blocking-compare.svg" alt="blocking compare"></div>
  <div class="card"><img src="./04-cumulative-failures.svg" alt="cumulative failures"></div>
  <div class="card"><a href="./summary.md">summary.md</a></div>
</body>
</html>
`;

  fs.writeFileSync(indexPath, html, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Predictive charts generated in: ${outputDir}`);
  // eslint-disable-next-line no-console
  console.log(`Chart preview: ${indexPath}`);
}

main();
