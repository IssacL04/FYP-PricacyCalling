const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../src/utils/errors');
const {
  ASTERISK_FULL_SOURCE,
  OpsLogService,
  normalizeLogLevelFromPriority,
  parseAsteriskFullLine,
  parseJournalLine
} = require('../src/services/ops-log-service');

test('normalizeLogLevelFromPriority maps syslog priorities', () => {
  assert.equal(normalizeLogLevelFromPriority('2'), 'error');
  assert.equal(normalizeLogLevelFromPriority('4'), 'warning');
  assert.equal(normalizeLogLevelFromPriority('6'), 'info');
  assert.equal(normalizeLogLevelFromPriority('7'), 'debug');
  assert.equal(normalizeLogLevelFromPriority('invalid'), 'info');
});

test('parseJournalLine parses valid JSON line', () => {
  const line = JSON.stringify({
    MESSAGE: 'hello world',
    PRIORITY: '4',
    __REALTIME_TIMESTAMP: '1774089621068741',
    __CURSOR: 'cursor-1'
  });

  const parsed = parseJournalLine(line, 'privacy-calling-api');
  assert.equal(parsed.service, 'privacy-calling-api');
  assert.equal(parsed.level, 'warning');
  assert.equal(parsed.message, 'hello world');
  assert.equal(parsed.cursor, 'cursor-1');
  assert.ok(parsed.timestamp);
});

test('parseJournalLine ignores invalid or empty records', () => {
  assert.equal(parseJournalLine('', 'svc'), null);
  assert.equal(parseJournalLine('not-json', 'svc'), null);
  assert.equal(parseJournalLine(JSON.stringify({ MESSAGE: '' }), 'svc'), null);
});

test('parseAsteriskFullLine parses level and timestamp from full log line', () => {
  const parsed = parseAsteriskFullLine('[2026-03-27 10:22:30] WARNING[1234]: chan_sip.c: sample warning');
  assert.equal(parsed.service, ASTERISK_FULL_SOURCE);
  assert.equal(parsed.level, 'warning');
  assert.ok(parsed.timestamp);
  assert.match(parsed.message, /sample warning/);
});

test('parseAsteriskFullLine maps verbose/debug as debug', () => {
  const parsed = parseAsteriskFullLine('[2026-03-27 10:22:30] VERBOSE[1234]: pbx.c: call info');
  assert.equal(parsed.level, 'debug');
});

test('OpsLogService getLogs filters, sorts and limits', async () => {
  const execFileFn = async (cmd, args) => {
    const service = args[args.indexOf('-u') + 1];
    if (service === 'privacy-calling-api') {
      return {
        stdout: [
          JSON.stringify({
            MESSAGE: 'api info',
            PRIORITY: '6',
            __REALTIME_TIMESTAMP: '2000000',
            __CURSOR: 'c1'
          }),
          JSON.stringify({
            MESSAGE: 'api warn',
            PRIORITY: '4',
            __REALTIME_TIMESTAMP: '3000000',
            __CURSOR: 'c2'
          })
        ].join('\n')
      };
    }

    return {
      stdout: JSON.stringify({
        MESSAGE: 'asterisk error',
        PRIORITY: '3',
        __REALTIME_TIMESTAMP: '4000000',
        __CURSOR: 'c3'
      })
    };
  };

  const service = new OpsLogService({
    managedServices: ['privacy-calling-api', 'asterisk'],
    defaultLimit: 10,
    maxLimit: 20,
    defaultSinceSec: 600,
    commandTimeoutMs: 1000,
    journalctlBin: 'journalctl',
    sudoBin: 'sudo',
    useSudo: false,
    execFileFn
  });

  const result = await service.getLogs({
    services: 'privacy-calling-api,asterisk',
    levels: 'warning,error',
    limit: '2',
    sinceSec: '120'
  });

  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].message, 'asterisk error');
  assert.equal(result.entries[1].message, 'api warn');
  assert.equal(result.query.since_sec, 120);
  assert.deepEqual(result.warnings, []);
});

test('OpsLogService emits warning when one service log query fails', async () => {
  const service = new OpsLogService({
    managedServices: ['privacy-calling-api', 'asterisk'],
    defaultLimit: 10,
    maxLimit: 20,
    defaultSinceSec: 600,
    commandTimeoutMs: 1000,
    journalctlBin: 'journalctl',
    sudoBin: 'sudo',
    useSudo: false,
    execFileFn: async (cmd, args) => {
      const target = args[args.indexOf('-u') + 1];
      if (target === 'asterisk') {
        throw new Error('permission denied');
      }
      return {
        stdout: JSON.stringify({
          MESSAGE: 'api info',
          PRIORITY: '6',
          __REALTIME_TIMESTAMP: '2000000'
        })
      };
    }
  });

  const payload = await service.getLogs({ services: 'privacy-calling-api,asterisk' });
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.warnings.length, 1);
  assert.equal(payload.warnings[0].service, 'asterisk');
});

test('OpsLogService validates unknown service and level', async () => {
  const service = new OpsLogService({
    managedServices: ['privacy-calling-api'],
    defaultLimit: 10,
    maxLimit: 20,
    defaultSinceSec: 600,
    commandTimeoutMs: 1000,
    journalctlBin: 'journalctl',
    sudoBin: 'sudo',
    useSudo: false,
    execFileFn: async () => ({ stdout: '' })
  });

  await assert.rejects(
    () => service.getLogs({ services: 'unknown' }),
    (error) => error instanceof AppError && error.code === 'unknown_log_service'
  );

  await assert.rejects(
    () => service.getLogs({ levels: 'trace' }),
    (error) => error instanceof AppError && error.code === 'unknown_log_level'
  );
});

test('OpsLogService reads from asterisk-full source via tail', async () => {
  const service = new OpsLogService({
    managedServices: ['privacy-calling-api'],
    defaultLimit: 10,
    maxLimit: 20,
    defaultSinceSec: 600,
    commandTimeoutMs: 1000,
    journalctlBin: 'journalctl',
    tailBin: 'tail',
    sudoBin: 'sudo',
    useSudo: false,
    includeAsteriskFull: true,
    asteriskFullPath: '/var/log/asterisk/full',
    execFileFn: async (cmd, args) => {
      if (cmd === 'tail') {
        return {
          stdout: [
            'NOTICE[1234]: first notice',
            'ERROR[1234]: bad thing happened'
          ].join('\n')
        };
      }
      return { stdout: '' };
    }
  });

  const payload = await service.getLogs({
    services: ASTERISK_FULL_SOURCE,
    levels: 'info,error',
    limit: '10',
    sinceSec: '1200'
  });

  assert.equal(payload.entries.length, 2);
  assert.equal(payload.entries[0].service, ASTERISK_FULL_SOURCE);
  assert.equal(payload.entries[0].level, 'error');
});
