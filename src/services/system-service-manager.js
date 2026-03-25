const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { AppError } = require('../utils/errors');

const execFileAsync = promisify(execFile);

const SHOW_PROPERTIES = [
  'Id',
  'Description',
  'LoadState',
  'ActiveState',
  'SubState',
  'UnitFileState',
  'MainPID',
  'FragmentPath',
  'ActiveEnterTimestamp',
  'ExecMainStartTimestamp'
];

function parseSystemctlShow(stdout) {
  const result = {};
  const lines = String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    result[key] = value;
  }

  return result;
}

function toServiceStatus(parsed) {
  return {
    id: parsed.Id || '',
    description: parsed.Description || '',
    load_state: parsed.LoadState || 'unknown',
    active_state: parsed.ActiveState || 'unknown',
    sub_state: parsed.SubState || 'unknown',
    unit_file_state: parsed.UnitFileState || 'unknown',
    main_pid: Number.parseInt(parsed.MainPID, 10) || 0,
    fragment_path: parsed.FragmentPath || '',
    active_since: parsed.ActiveEnterTimestamp || parsed.ExecMainStartTimestamp || ''
  };
}

function isSudoPermissionError(stderr = '') {
  const text = String(stderr).toLowerCase();
  return (
    text.includes('a password is required') ||
    text.includes('permission denied') ||
    text.includes('is not in the sudoers file') ||
    text.includes('may not run sudo') ||
    text.includes('not allowed')
  );
}

class SystemServiceManager {
  constructor({
    managedServices,
    allowServiceControl,
    useSudoForControl,
    commandTimeoutMs,
    systemctlBin,
    sudoBin,
    execFileFn
  }) {
    this.managedServices = new Set(managedServices || []);
    this.allowServiceControl = Boolean(allowServiceControl);
    this.useSudoForControl = Boolean(useSudoForControl);
    this.commandTimeoutMs = commandTimeoutMs || 8000;
    this.systemctlBin = systemctlBin || 'systemctl';
    this.sudoBin = sudoBin || 'sudo';
    this.execFileFn = execFileFn || execFileAsync;
  }

  listManagedServices() {
    return [...this.managedServices];
  }

  async getServicesStatus() {
    const names = this.listManagedServices();
    const statuses = await Promise.all(names.map((name) => this.getServiceStatus(name)));
    return statuses;
  }

  async getServiceStatus(serviceName) {
    this.assertServiceAllowed(serviceName);

    try {
      const { stdout } = await this.runSystemctl(
        [
          'show',
          serviceName,
          `--property=${SHOW_PROPERTIES.join(',')}`,
          '--no-pager'
        ],
        { useSudo: false }
      );
      return toServiceStatus(parseSystemctlShow(stdout));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Unable to query service "${serviceName}"`,
        500,
        'service_status_query_failed'
      );
    }
  }

  async controlService(serviceName, action) {
    this.assertServiceAllowed(serviceName);
    this.assertActionAllowed(action);

    if (!this.allowServiceControl) {
      throw new AppError(
        'Service control is disabled by configuration',
        403,
        'service_control_disabled'
      );
    }

    await this.runSystemctl([action, serviceName, '--no-pager'], {
      useSudo: this.useSudoForControl
    });

    return this.getServiceStatus(serviceName);
  }

  assertServiceAllowed(serviceName) {
    if (!this.managedServices.has(serviceName)) {
      throw new AppError(
        `Service "${serviceName}" is not in managed service allow-list`,
        400,
        'unknown_service'
      );
    }
  }

  assertActionAllowed(action) {
    if (!['start', 'stop', 'restart'].includes(action)) {
      throw new AppError(
        `Unsupported action "${action}". Allowed: start/stop/restart`,
        400,
        'unsupported_service_action'
      );
    }
  }

  async runSystemctl(args, { useSudo }) {
    const finalUseSudo = Boolean(useSudo);
    const cmd = finalUseSudo ? this.sudoBin : this.systemctlBin;
    const cmdArgs = finalUseSudo
      ? ['-n', this.systemctlBin, ...args]
      : args;

    try {
      return await this.execFileFn(cmd, cmdArgs, {
        timeout: this.commandTimeoutMs
      });
    } catch (error) {
      const stderr = error && error.stderr ? String(error.stderr) : '';
      if (isSudoPermissionError(stderr)) {
        throw new AppError(
          'Service control requires sudo NOPASSWD permission for systemctl',
          403,
          'service_control_forbidden'
        );
      }

      throw new AppError(
        stderr.trim() || `systemctl ${args.join(' ')} failed`,
        500,
        'service_control_failed'
      );
    }
  }
}

module.exports = {
  SystemServiceManager,
  parseSystemctlShow
};
