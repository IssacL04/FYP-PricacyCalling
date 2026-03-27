const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { AppError } = require('../utils/errors');

const execFileAsync = promisify(execFile);

const SUPPORTED_LOG_LEVELS = ['debug', 'info', 'warning', 'error'];
const ASTERISK_FULL_SOURCE = 'asterisk-full';

function normalizeLogLevelFromPriority(priority) {
  const parsed = Number.parseInt(priority, 10);
  if (!Number.isFinite(parsed)) {
    return 'info';
  }
  if (parsed <= 3) {
    return 'error';
  }
  if (parsed === 4) {
    return 'warning';
  }
  if (parsed <= 6) {
    return 'info';
  }
  return 'debug';
}

function parseTimestampMicros(microsValue) {
  const micros = Number.parseInt(microsValue, 10);
  if (!Number.isFinite(micros) || micros <= 0) {
    return null;
  }
  return micros;
}

function parseAsteriskDatetime(text) {
  const value = String(text || '').trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(value)) {
    const normalized = value.replace(' ', 'T');
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (/^[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/.test(value)) {
    const year = new Date().getFullYear();
    const date = new Date(`${value} ${year}`);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function normalizeAsteriskFileLevel(levelToken, rawLine) {
  const token = String(levelToken || '').toUpperCase();
  const line = String(rawLine || '').toUpperCase();

  if (token.includes('ERROR') || line.includes(' ERROR[') || line.includes(' ERROR:')) {
    return 'error';
  }

  if (token.includes('WARNING') || token.includes('SECURITY') || line.includes(' WARNING[')) {
    return 'warning';
  }

  if (
    token.includes('DEBUG') ||
    token.includes('VERBOSE') ||
    token.includes('DTMF') ||
    line.includes(' DEBUG[') ||
    line.includes(' VERBOSE[')
  ) {
    return 'debug';
  }

  return 'info';
}

function parseJournalLine(line, service) {
  if (!line || !String(line).trim()) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    return null;
  }

  const message = typeof parsed.MESSAGE === 'string' ? parsed.MESSAGE.trim() : '';
  if (!message) {
    return null;
  }

  const tsMicros = parseTimestampMicros(parsed.__REALTIME_TIMESTAMP);
  const tsIso = tsMicros
    ? new Date(Math.floor(tsMicros / 1000)).toISOString()
    : null;

  return {
    timestamp: tsIso,
    timestamp_micros: tsMicros || 0,
    service,
    level: normalizeLogLevelFromPriority(parsed.PRIORITY),
    message,
    cursor: typeof parsed.__CURSOR === 'string' ? parsed.__CURSOR : ''
  };
}

function parseAsteriskFullLine(line, service = ASTERISK_FULL_SOURCE, fallbackOrder = 0) {
  const raw = String(line || '').trim();
  if (!raw) {
    return null;
  }

  const timestampMatch = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  const payload = timestampMatch ? timestampMatch[2] : raw;
  const dateText = timestampMatch ? timestampMatch[1] : '';

  const levelMatch = payload.match(/\b(NOTICE|WARNING|ERROR|DEBUG|VERBOSE|SECURITY|DTMF)\b/i);
  const levelToken = levelMatch ? levelMatch[1] : '';
  const level = normalizeAsteriskFileLevel(levelToken, payload);

  const parsedDate = parseAsteriskDatetime(dateText);
  const timestamp = parsedDate ? parsedDate.toISOString() : null;
  const timestampMicros = parsedDate
    ? parsedDate.getTime() * 1000
    : Math.max(0, Number.parseInt(fallbackOrder, 10) || 0);

  return {
    timestamp,
    timestamp_micros: timestampMicros,
    service,
    level,
    message: payload,
    cursor: ''
  };
}

function toNonEmptyList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

class OpsLogService {
  constructor({
    managedServices,
    defaultLimit,
    maxLimit,
    defaultSinceSec,
    commandTimeoutMs,
    journalctlBin,
    tailBin,
    sudoBin,
    useSudo,
    includeAsteriskFull,
    asteriskFullPath,
    execFileFn
  }) {
    this.journalServices = new Set(managedServices || []);
    this.defaultLimit = defaultLimit || 200;
    this.maxLimit = maxLimit || 500;
    this.defaultSinceSec = defaultSinceSec || 600;
    this.commandTimeoutMs = commandTimeoutMs || 8000;
    this.journalctlBin = journalctlBin || 'journalctl';
    this.tailBin = tailBin || 'tail';
    this.sudoBin = sudoBin || 'sudo';
    this.useSudo = Boolean(useSudo);
    this.includeAsteriskFull = includeAsteriskFull !== false;
    this.asteriskFullPath = asteriskFullPath || '/var/log/asterisk/full';
    this.execFileFn = execFileFn || execFileAsync;

    this.logServices = new Set(this.journalServices);
    if (this.includeAsteriskFull) {
      this.logServices.add(ASTERISK_FULL_SOURCE);
    }
  }

  listLogServices() {
    return [...this.logServices];
  }

  // Backward-compatible name used by existing app wiring.
  listManagedServices() {
    return this.listLogServices();
  }

  parseServices(value) {
    const requested = toNonEmptyList(value);
    if (requested.length === 0) {
      return this.listLogServices();
    }

    const unknown = requested.filter((service) => !this.logServices.has(service));
    if (unknown.length > 0) {
      throw new AppError(
        `Unknown log service(s): ${unknown.join(', ')}`,
        400,
        'unknown_log_service'
      );
    }
    return requested;
  }

  parseLevels(value) {
    const requested = toNonEmptyList(value).map((item) => item.toLowerCase());
    if (requested.length === 0) {
      return [...SUPPORTED_LOG_LEVELS];
    }

    const unknown = requested.filter((level) => !SUPPORTED_LOG_LEVELS.includes(level));
    if (unknown.length > 0) {
      throw new AppError(
        `Unknown log level(s): ${unknown.join(', ')}`,
        400,
        'unknown_log_level'
      );
    }
    return requested;
  }

  parseLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return this.defaultLimit;
    }
    return Math.max(1, Math.min(this.maxLimit, parsed));
  }

  parseSinceSec(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return this.defaultSinceSec;
    }
    return Math.max(5, Math.min(24 * 3600, parsed));
  }

  async runCommand(bin, args) {
    const cmd = this.useSudo ? this.sudoBin : bin;
    const cmdArgs = this.useSudo
      ? ['-n', bin, ...args]
      : args;

    return this.execFileFn(cmd, cmdArgs, {
      timeout: this.commandTimeoutMs,
      maxBuffer: 12 * 1024 * 1024
    });
  }

  async queryJournalServiceLogs(service, { sinceSec, limit }) {
    const args = [
      '-u',
      service,
      '--since',
      `${sinceSec} seconds ago`,
      '--no-pager',
      '-o',
      'json',
      '-n',
      String(limit)
    ];

    const { stdout } = await this.runCommand(this.journalctlBin, args);

    return String(stdout || '')
      .split('\n')
      .map((line) => parseJournalLine(line, service))
      .filter(Boolean);
  }

  async queryAsteriskFullLogs({ sinceSec, limit }) {
    const multiplier = 8;
    const linesToRead = Math.max(
      limit,
      Math.min(limit * multiplier, this.maxLimit * multiplier)
    );

    const { stdout } = await this.runCommand(this.tailBin, [
      '-n',
      String(linesToRead),
      this.asteriskFullPath
    ]);

    const nowMicros = Date.now() * 1000;
    const cutoffMicros = nowMicros - (sinceSec * 1000 * 1000);

    return String(stdout || '')
      .split('\n')
      .map((line, index) => parseAsteriskFullLine(line, ASTERISK_FULL_SOURCE, index + 1))
      .filter(Boolean)
      .filter((entry) => {
        if (!entry.timestamp) {
          return true;
        }
        return entry.timestamp_micros >= cutoffMicros;
      });
  }

  async queryServiceLogs(service, { sinceSec, limit }) {
    if (service === ASTERISK_FULL_SOURCE) {
      return this.queryAsteriskFullLogs({ sinceSec, limit });
    }
    return this.queryJournalServiceLogs(service, { sinceSec, limit });
  }

  async getLogs(query = {}) {
    const services = this.parseServices(query.services);
    const levels = new Set(this.parseLevels(query.levels));
    const limit = this.parseLimit(query.limit);
    const sinceSec = this.parseSinceSec(query.sinceSec);
    const warnings = [];
    const entries = [];

    await Promise.all(services.map(async (service) => {
      try {
        const serviceEntries = await this.queryServiceLogs(service, { sinceSec, limit });
        for (const entry of serviceEntries) {
          if (levels.has(entry.level)) {
            entries.push(entry);
          }
        }
      } catch (error) {
        warnings.push({
          service,
          message: error && error.message ? error.message : `Failed to read logs for ${service}`
        });
      }
    }));

    entries.sort((a, b) => b.timestamp_micros - a.timestamp_micros);

    return {
      entries: entries.slice(0, limit).map((entry) => ({
        timestamp: entry.timestamp,
        service: entry.service,
        level: entry.level,
        message: entry.message,
        cursor: entry.cursor
      })),
      warnings,
      query: {
        services,
        levels: [...levels],
        since_sec: sinceSec,
        limit
      }
    };
  }
}

module.exports = {
  OpsLogService,
  ASTERISK_FULL_SOURCE,
  SUPPORTED_LOG_LEVELS,
  normalizeLogLevelFromPriority,
  parseJournalLine,
  parseAsteriskFullLine,
  normalizeAsteriskFileLevel
};
