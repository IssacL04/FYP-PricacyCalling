const test = require('node:test');
const assert = require('node:assert/strict');
const { SystemServiceManager, parseSystemctlShow } = require('../src/services/system-service-manager');

test('parseSystemctlShow parses key/value lines', () => {
  const parsed = parseSystemctlShow('Id=asterisk.service\nActiveState=active\nSubState=running\n');
  assert.equal(parsed.Id, 'asterisk.service');
  assert.equal(parsed.ActiveState, 'active');
  assert.equal(parsed.SubState, 'running');
});

test('getServiceStatus returns normalized fields', async () => {
  const manager = new SystemServiceManager({
    managedServices: ['asterisk'],
    allowServiceControl: true,
    useSudoForControl: true,
    commandTimeoutMs: 1000,
    systemctlBin: 'systemctl',
    sudoBin: 'sudo',
    execFileFn: async () => ({
      stdout: [
        'Id=asterisk.service',
        'Description=Asterisk PBX',
        'LoadState=loaded',
        'ActiveState=active',
        'SubState=running',
        'UnitFileState=enabled',
        'MainPID=123',
        'FragmentPath=/lib/systemd/system/asterisk.service'
      ].join('\n')
    })
  });

  const status = await manager.getServiceStatus('asterisk');
  assert.equal(status.id, 'asterisk.service');
  assert.equal(status.active_state, 'active');
  assert.equal(status.main_pid, 123);
});

test('controlService enforces action/service allow-list and command path', async () => {
  const calls = [];
  const manager = new SystemServiceManager({
    managedServices: ['asterisk'],
    allowServiceControl: true,
    useSudoForControl: true,
    commandTimeoutMs: 1000,
    systemctlBin: 'systemctl',
    sudoBin: 'sudo',
    execFileFn: async (cmd, args) => {
      calls.push([cmd, args]);
      if (args.includes('show')) {
        return { stdout: 'Id=asterisk\nActiveState=active\nSubState=running\nMainPID=1\n' };
      }
      return { stdout: '' };
    }
  });

  await assert.rejects(
    () => manager.controlService('nginx', 'restart'),
    (error) => error && error.code === 'unknown_service'
  );
  await assert.rejects(
    () => manager.controlService('asterisk', 'reload'),
    (error) => error && error.code === 'unsupported_service_action'
  );

  await manager.controlService('asterisk', 'restart');
  assert.equal(calls[0][0], 'sudo');
  assert.deepEqual(calls[0][1], ['-n', 'systemctl', 'restart', 'asterisk', '--no-pager']);
});

test('controlService can be disabled from config', async () => {
  const manager = new SystemServiceManager({
    managedServices: ['asterisk'],
    allowServiceControl: false,
    useSudoForControl: true,
    commandTimeoutMs: 1000,
    systemctlBin: 'systemctl',
    sudoBin: 'sudo',
    execFileFn: async () => ({ stdout: '' })
  });

  await assert.rejects(
    () => manager.controlService('asterisk', 'restart'),
    (error) => error && error.code === 'service_control_disabled'
  );
});
