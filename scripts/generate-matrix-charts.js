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

function listMatrixDirs(dataDir) {
  if (!fs.existsSync(dataDir)) {
    return [];
  }
  return fs.readdirSync(dataDir)
    .filter((name) => /^matrix-\d+$/.test(name))
    .map((name) => path.join(dataDir, name))
    .sort((a, b) => {
      const sa = fs.statSync(a).mtimeMs;
      const sb = fs.statSync(b).mtimeMs;
      return sb - sa;
    });
}

function pickAggregateJsonPath(projectRoot, cliPath) {
  if (cliPath) {
    return path.resolve(cliPath);
  }

  const dataDir = path.join(projectRoot, 'data');
  const candidates = listMatrixDirs(dataDir);
  for (const dir of candidates) {
    const p = path.join(dir, 'matrix-aggregate.json');
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error('cannot find matrix-aggregate.json, pass --aggregate-json');
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const k = row[key];
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k).push(row);
  });
  return map;
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function palette(index) {
  const colors = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf'
  ];
  return colors[index % colors.length];
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
  yTicks = 5,
  series
}) {
  const width = 980;
  const height = 560;
  const margin = {
    top: 72,
    right: 200,
    bottom: 72,
    left: 90
  };
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
  parts.push('<rect x="0" y="0" width="100%" height="56" fill="#f4f8ff"/>');
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

  series.forEach((line, idx) => {
    const color = line.color || palette(idx);
    const validPoints = line.points
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);

    if (validPoints.length === 0) {
      return;
    }

    const polyline = validPoints
      .map((p) => `${xMap(p.x).toFixed(2)},${yMap(p.y).toFixed(2)}`)
      .join(' ');
    parts.push(`<polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.5"/>`);

    validPoints.forEach((p) => {
      parts.push(`<circle cx="${xMap(p.x).toFixed(2)}" cy="${yMap(p.y).toFixed(2)}" r="3.5" fill="${color}"/>`);
    });
  });

  let legendY = margin.top + 8;
  series.forEach((line, idx) => {
    const color = line.color || palette(idx);
    const x0 = margin.left + plotW + 20;
    parts.push(`<line x1="${x0}" y1="${legendY}" x2="${x0 + 22}" y2="${legendY}" stroke="${color}" stroke-width="3"/>`);
    parts.push(`<text x="${x0 + 30}" y="${legendY + 4}" font-size="12" font-family="Arial, sans-serif" fill="#2e3440">${line.name}</text>`);
    legendY += 22;
  });

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function writeChart({
  rows,
  outputPath,
  title,
  subtitle,
  xField,
  yField,
  xLabel,
  yLabel,
  yRangeMode = 'auto'
}) {
  const byVirtual = groupBy(rows, 'virtual_count');
  const series = Array.from(byVirtual.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([virtualCount, list], idx) => ({
      name: `virtual=${virtualCount}`,
      color: palette(idx),
      points: list
        .map((row) => ({
          x: numberOrNull(row[xField]),
          y: numberOrNull(row[yField])
        }))
        .filter((p) => p.x !== null && p.y !== null)
    }));

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  if (allX.length === 0 || allY.length === 0) {
    throw new Error(`no valid data points for ${title}`);
  }

  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  let yMin = Math.min(...allY);
  let yMax = Math.max(...allY);

  if (yRangeMode === 'ratio') {
    yMin = 0;
    yMax = 1;
  } else {
    const span = Math.max(0.0001, yMax - yMin);
    yMin = Math.max(0, yMin - span * 0.1);
    yMax = yMax + span * 0.15;
  }

  const xTicks = Array.from(new Set(allX)).sort((a, b) => a - b);
  const svg = createLineChartSvg({
    title,
    subtitle,
    xLabel,
    yLabel,
    xMin,
    xMax,
    yMin,
    yMax,
    xTicks,
    yTicks: 5,
    series
  });

  fs.writeFileSync(outputPath, svg, 'utf8');
}

function uniqueSortedNumbers(rows, field) {
  return Array.from(
    new Set(
      rows
        .map((row) => numberOrNull(row[field]))
        .filter((value) => value !== null)
    )
  ).sort((a, b) => a - b);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '').trim();
  if (raw.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  function toHex(n) {
    const safe = Math.max(0, Math.min(255, Math.round(n)));
    return safe.toString(16).padStart(2, '0');
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColor(a, b, t) {
  const p = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * p,
    g: a.g + (b.g - a.g) * p,
    b: a.b + (b.b - a.b) * p
  };
}

function heatColor(value, min, max) {
  if (!Number.isFinite(value)) {
    return '#e5e9f0';
  }
  if (max <= min) {
    return '#8bc34a';
  }

  const red = hexToRgb('#d73027');
  const yellow = hexToRgb('#fee08b');
  const green = hexToRgb('#1a9850');
  const ratio = clamp01((value - min) / (max - min));
  if (ratio < 0.5) {
    return rgbToHex(mixColor(red, yellow, ratio * 2));
  }
  return rgbToHex(mixColor(yellow, green, (ratio - 0.5) * 2));
}

function createHeatmapSvg({
  title,
  subtitle,
  xValues,
  yValues,
  zLabel,
  valueLookup,
  valueFormat,
  zMin,
  zMax
}) {
  const width = 980;
  const height = 620;
  const margin = {
    top: 72,
    right: 170,
    bottom: 90,
    left: 120
  };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const cellW = plotW / Math.max(1, xValues.length);
  const cellH = plotH / Math.max(1, yValues.length);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push('<rect width="100%" height="100%" fill="#ffffff"/>');
  parts.push('<rect x="0" y="0" width="100%" height="56" fill="#f4f8ff"/>');
  parts.push(`<text x="${margin.left}" y="34" font-size="24" font-family="Arial, sans-serif" fill="#1b2a41">${title}</text>`);
  if (subtitle) {
    parts.push(`<text x="${margin.left}" y="54" font-size="13" font-family="Arial, sans-serif" fill="#415a77">${subtitle}</text>`);
  }

  yValues.forEach((y, yi) => {
    xValues.forEach((x, xi) => {
      const value = valueLookup.get(`${x}|${y}`);
      const color = heatColor(value, zMin, zMax);
      const px = margin.left + xi * cellW;
      const py = margin.top + yi * cellH;
      parts.push(`<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${cellW.toFixed(2)}" height="${cellH.toFixed(2)}" fill="${color}" stroke="#ffffff" stroke-width="1"/>`);
      const text = Number.isFinite(value) ? valueFormat(value) : '-';
      parts.push(`<text x="${(px + cellW / 2).toFixed(2)}" y="${(py + cellH / 2 + 4).toFixed(2)}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#1f2937">${text}</text>`);
    });
  });

  xValues.forEach((x, xi) => {
    const px = margin.left + xi * cellW + cellW / 2;
    parts.push(`<text x="${px.toFixed(2)}" y="${(margin.top + plotH + 24).toFixed(2)}" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${x}</text>`);
  });
  yValues.forEach((y, yi) => {
    const py = margin.top + yi * cellH + cellH / 2 + 4;
    parts.push(`<text x="${(margin.left - 12).toFixed(2)}" y="${py.toFixed(2)}" text-anchor="end" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${y}</text>`);
  });

  parts.push(`<line x1="${margin.left}" y1="${(margin.top + plotH).toFixed(2)}" x2="${(margin.left + plotW).toFixed(2)}" y2="${(margin.top + plotH).toFixed(2)}" stroke="#2e3440" stroke-width="1.5"/>`);
  parts.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(margin.top + plotH).toFixed(2)}" stroke="#2e3440" stroke-width="1.5"/>`);

  parts.push(`<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(height - 28).toFixed(2)}" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" fill="#2e3440">Online Users</text>`);
  parts.push(`<text x="26" y="${(margin.top + plotH / 2).toFixed(2)}" transform="rotate(-90 26 ${(margin.top + plotH / 2).toFixed(2)})" text-anchor="middle" font-size="13" font-family="Arial, sans-serif" fill="#2e3440">Virtual Number Count</text>`);

  const legendX = margin.left + plotW + 28;
  const legendY = margin.top + 20;
  const legendW = 24;
  const legendH = Math.max(140, plotH - 40);
  const steps = 30;
  for (let i = 0; i < steps; i += 1) {
    const ratio0 = i / steps;
    const ratio1 = (i + 1) / steps;
    const value = zMax - ratio0 * (zMax - zMin);
    const py = legendY + ratio0 * legendH;
    const h = (ratio1 - ratio0) * legendH;
    const color = heatColor(value, zMin, zMax);
    parts.push(`<rect x="${legendX}" y="${py.toFixed(2)}" width="${legendW}" height="${h.toFixed(2)}" fill="${color}" stroke="none"/>`);
  }
  parts.push(`<rect x="${legendX}" y="${legendY}" width="${legendW}" height="${legendH}" fill="none" stroke="#34495e" stroke-width="1"/>`);
  parts.push(`<text x="${legendX + legendW + 10}" y="${legendY + 4}" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${zMax.toFixed(3)}</text>`);
  parts.push(`<text x="${legendX + legendW + 10}" y="${(legendY + legendH + 4).toFixed(2)}" font-size="12" font-family="Arial, sans-serif" fill="#4c566a">${zMin.toFixed(3)}</text>`);
  parts.push(`<text x="${legendX - 2}" y="${legendY - 10}" font-size="12" font-family="Arial, sans-serif" fill="#2e3440">${zLabel}</text>`);

  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function writeHeatmapChart({
  rows,
  outputPath,
  title,
  subtitle,
  zField,
  zLabel,
  valueFormat
}) {
  const xValues = uniqueSortedNumbers(rows, 'user_count');
  const yValues = uniqueSortedNumbers(rows, 'virtual_count');
  const values = rows
    .map((row) => numberOrNull(row[zField]))
    .filter((value) => value !== null);
  if (xValues.length === 0 || yValues.length === 0 || values.length === 0) {
    throw new Error(`cannot build heatmap: ${title}`);
  }

  const valueLookup = new Map();
  rows.forEach((row) => {
    const x = numberOrNull(row.user_count);
    const y = numberOrNull(row.virtual_count);
    const z = numberOrNull(row[zField]);
    if (x === null || y === null || z === null) {
      return;
    }
    valueLookup.set(`${x}|${y}`, z);
  });

  const svg = createHeatmapSvg({
    title,
    subtitle,
    xValues,
    yValues,
    zLabel,
    valueLookup,
    valueFormat,
    zMin: Math.min(...values),
    zMax: Math.max(...values)
  });
  fs.writeFileSync(outputPath, svg, 'utf8');
}

function writeMarginalGainChart({ rows, outputPath }) {
  const users = uniqueSortedNumbers(rows, 'user_count');
  const lookup = new Map();
  rows.forEach((row) => {
    const u = numberOrNull(row.user_count);
    const v = numberOrNull(row.virtual_count);
    const c = numberOrNull(row.create_success_rate_mean);
    if (u === null || v === null || c === null) {
      return;
    }
    lookup.set(`${u}|${v}`, c);
  });

  function gain(fromV, toV) {
    return users
      .map((u) => {
        const a = lookup.get(`${u}|${fromV}`);
        const b = lookup.get(`${u}|${toV}`);
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
          return null;
        }
        return { x: u, y: b - a };
      })
      .filter(Boolean);
  }

  const series = [
    { name: 'gain 10->20 virtual', color: '#ff7f0e', points: gain(10, 20) },
    { name: 'gain 20->30 virtual', color: '#2ca02c', points: gain(20, 30) },
    { name: 'gain 10->30 virtual', color: '#1f77b4', points: gain(10, 30) }
  ];

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const yMin = Math.min(...allY, 0);
  const yMax = Math.max(...allY, 0.01);
  const span = Math.max(0.001, yMax - yMin);

  const svg = createLineChartSvg({
    title: 'Marginal Gain From Increasing Virtual Pool',
    subtitle: 'Y shows additional create-success-rate gained when expanding virtual number pool',
    xLabel: 'Online Users',
    yLabel: 'Delta Create Success Rate',
    xMin,
    xMax,
    yMin: yMin - span * 0.1,
    yMax: yMax + span * 0.15,
    xTicks: users,
    yTicks: 5,
    series
  });
  fs.writeFileSync(outputPath, svg, 'utf8');
}

function buildSummaryMarkdown(rows, aggregateJsonPath) {
  const virtuals = uniqueSortedNumbers(rows, 'virtual_count');
  const lines = [];
  lines.push('# Matrix Benchmark Summary');
  lines.push('');
  lines.push(`Source: \`${aggregateJsonPath}\``);
  lines.push('');
  lines.push('| Virtual Count | Avg Create Success Rate | Avg Terminal Completed Rate | Avg Peak RSS (MB) |');
  lines.push('|---:|---:|---:|---:|');

  virtuals.forEach((v) => {
    const subset = rows.filter((row) => Number(row.virtual_count) === v);
    const avgCreate = subset.reduce((s, r) => s + Number(r.create_success_rate_mean || 0), 0) / subset.length;
    const avgCompleted = subset.reduce((s, r) => s + Number(r.terminal_completed_rate_mean || 0), 0) / subset.length;
    const avgRss = subset.reduce((s, r) => s + Number(r.peak_rss_mb_mean || 0), 0) / subset.length;
    lines.push(`| ${v} | ${avgCreate.toFixed(4)} | ${avgCompleted.toFixed(4)} | ${avgRss.toFixed(2)} |`);
  });

  lines.push('');
  lines.push('## Quick Findings');
  lines.push('');
  lines.push('1. Create success rate is strongly constrained by virtual pool size and decreases as online users rise.');
  lines.push('2. Terminal completed rate remains relatively high after call creation, indicating front-stage capacity is the dominant bottleneck.');
  lines.push('3. Server load/core remains low in this dataset, suggesting signaling/resource policy limits are reached before CPU saturation.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.join(__dirname, '..');
  const aggregateJsonPath = pickAggregateJsonPath(projectRoot, args['aggregate-json']);
  const aggregateRows = JSON.parse(fs.readFileSync(aggregateJsonPath, 'utf8'));
  if (!Array.isArray(aggregateRows) || aggregateRows.length === 0) {
    throw new Error(`aggregate rows not found in ${aggregateJsonPath}`);
  }

  const outputDir = path.resolve(
    String(args['output-dir'] || path.join(path.dirname(aggregateJsonPath), 'charts'))
  );
  fs.mkdirSync(outputDir, { recursive: true });

  writeChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '01-create-success-rate.svg'),
    title: 'Create Success Rate vs Online Users',
    subtitle: 'X: online user count, Y: create success rate, grouped by virtual pool size',
    xField: 'user_count',
    yField: 'create_success_rate_mean',
    xLabel: 'Online Users',
    yLabel: 'Create Success Rate',
    yRangeMode: 'ratio'
  });

  writeChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '02-terminal-completed-rate.svg'),
    title: 'Terminal Completed Rate vs Online Users',
    subtitle: 'X: online user count, Y: terminal completed rate, grouped by virtual pool size',
    xField: 'user_count',
    yField: 'terminal_completed_rate_mean',
    xLabel: 'Online Users',
    yLabel: 'Completed Rate',
    yRangeMode: 'ratio'
  });

  writeChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '03-server-rss-vs-pressure.svg'),
    title: 'Server RSS vs Test Pressure',
    subtitle: 'X: planned calls mean, Y: peak RSS MB, grouped by virtual pool size',
    xField: 'planned_calls_mean',
    yField: 'peak_rss_mb_mean',
    xLabel: 'Planned Calls (Mean)',
    yLabel: 'Peak RSS (MB)'
  });

  writeChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '04-server-heap-vs-pressure.svg'),
    title: 'Server Heap Ratio vs Test Pressure',
    subtitle: 'X: planned calls mean, Y: peak heap usage ratio, grouped by virtual pool size',
    xField: 'planned_calls_mean',
    yField: 'peak_heap_usage_ratio_mean',
    xLabel: 'Planned Calls (Mean)',
    yLabel: 'Peak Heap Usage Ratio'
  });

  writeChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '05-server-load-vs-pressure.svg'),
    title: 'Server Load/Core vs Test Pressure',
    subtitle: 'X: planned calls mean, Y: peak load per CPU (1m), grouped by virtual pool size',
    xField: 'planned_calls_mean',
    yField: 'peak_load_per_cpu_1m_mean',
    xLabel: 'Planned Calls (Mean)',
    yLabel: 'Peak Load/Core (1m)'
  });

  writeHeatmapChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '06-create-success-heatmap.svg'),
    title: 'Create Success Rate Heatmap',
    subtitle: 'Rows: virtual pool size, columns: online users',
    zField: 'create_success_rate_mean',
    zLabel: 'Create Rate',
    valueFormat: (value) => value.toFixed(3)
  });

  writeHeatmapChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '07-terminal-completed-heatmap.svg'),
    title: 'Terminal Completed Rate Heatmap',
    subtitle: 'Rows: virtual pool size, columns: online users',
    zField: 'terminal_completed_rate_mean',
    zLabel: 'Completed Rate',
    valueFormat: (value) => value.toFixed(3)
  });

  writeMarginalGainChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '08-marginal-gain-virtual-pool.svg')
  });

  writeHeatmapChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '09-server-load-heatmap.svg'),
    title: 'Server Load/Core Heatmap',
    subtitle: 'Rows: virtual pool size, columns: online users',
    zField: 'peak_load_per_cpu_1m_mean',
    zLabel: 'Load/Core',
    valueFormat: (value) => value.toFixed(3)
  });

  writeHeatmapChart({
    rows: aggregateRows,
    outputPath: path.join(outputDir, '10-server-rss-heatmap.svg'),
    title: 'Server RSS Heatmap',
    subtitle: 'Rows: virtual pool size, columns: online users',
    zField: 'peak_rss_mb_mean',
    zLabel: 'Peak RSS MB',
    valueFormat: (value) => value.toFixed(1)
  });

  const summaryPath = path.join(outputDir, 'summary.md');
  fs.writeFileSync(summaryPath, buildSummaryMarkdown(aggregateRows, aggregateJsonPath), 'utf8');

  const indexPath = path.join(outputDir, 'index.html');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Matrix Benchmark Charts</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1b2a41; background: #f6f9fc; }
    h1 { margin-bottom: 8px; }
    .meta { color: #415a77; margin-bottom: 20px; }
    .card { background: #fff; border: 1px solid #d9e2ec; border-radius: 10px; padding: 12px; margin-bottom: 18px; }
    img { width: 100%; max-width: 980px; display: block; border: 1px solid #eef2f7; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>Matrix Benchmark Charts</h1>
  <div class="meta">aggregate source: ${aggregateJsonPath}</div>
  <div class="card"><img src="./01-create-success-rate.svg" alt="create success rate"></div>
  <div class="card"><img src="./02-terminal-completed-rate.svg" alt="terminal completed rate"></div>
  <div class="card"><img src="./03-server-rss-vs-pressure.svg" alt="server rss"></div>
  <div class="card"><img src="./04-server-heap-vs-pressure.svg" alt="server heap"></div>
  <div class="card"><img src="./05-server-load-vs-pressure.svg" alt="server load"></div>
  <div class="card"><img src="./06-create-success-heatmap.svg" alt="create heatmap"></div>
  <div class="card"><img src="./07-terminal-completed-heatmap.svg" alt="completed heatmap"></div>
  <div class="card"><img src="./08-marginal-gain-virtual-pool.svg" alt="marginal gain"></div>
  <div class="card"><img src="./09-server-load-heatmap.svg" alt="load heatmap"></div>
  <div class="card"><img src="./10-server-rss-heatmap.svg" alt="rss heatmap"></div>
  <div class="card"><a href="./summary.md">summary.md</a></div>
</body>
</html>
`;
  fs.writeFileSync(indexPath, html, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Charts generated in: ${outputDir}`);
  // eslint-disable-next-line no-console
  console.log(`Chart preview: ${indexPath}`);
}

main();
