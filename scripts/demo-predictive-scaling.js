const path = require('path');
const { spawnSync } = require('child_process');

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

function toCliArgs(args) {
  const output = [];
  Object.entries(args).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    output.push(`--${key}`);
    if (String(value) !== 'true') {
      output.push(String(value));
    }
  });
  return output;
}

function runNodeScript(scriptPath, args) {
  const result = spawnSync('node', [scriptPath, ...args], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error(`${scriptPath} failed with exit code ${result.status}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = path.join(__dirname, '..');
  const outputDir = path.resolve(
    cwd,
    String(args['output-dir'] || path.join('data', `predictive-${Date.now()}`))
  );

  const simArgs = { ...args, 'output-dir': outputDir };
  const chartArgs = {
    'series-json': path.join(outputDir, 'series.json'),
    'output-dir': path.join(outputDir, 'charts')
  };

  runNodeScript('scripts/simulate-predictive-scaling.js', toCliArgs(simArgs));
  runNodeScript('scripts/generate-predictive-scaling-charts.js', toCliArgs(chartArgs));
}

main();
