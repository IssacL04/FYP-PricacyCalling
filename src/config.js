const path = require('path');

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toList(value, fallback) {
  if (!value) {
    return [...fallback];
  }

  const items = String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : [...fallback];
}

function loadConfig() {
  return {
    app: {
      port: toInt(process.env.APP_PORT, 8080),
      host: process.env.APP_HOST || '0.0.0.0',
      apiKey: process.env.API_KEY || 'dev-privacy-key'
    },
    db: {
      path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'privacy.db')
    },
    call: {
      timeoutSecDefault: toInt(process.env.CALL_TIMEOUT_SEC_DEFAULT, 30),
      timeoutSecMax: toInt(process.env.CALL_TIMEOUT_SEC_MAX, 120)
    },
    asterisk: {
      context: process.env.ASTERISK_DIAL_CONTEXT || 'privacy_bridge',
      exten: process.env.ASTERISK_DIAL_EXTEN || 's',
      priority: toInt(process.env.ASTERISK_DIAL_PRIORITY, 1),
      ami: {
        host: process.env.ASTERISK_AMI_HOST || '127.0.0.1',
        port: toInt(process.env.ASTERISK_AMI_PORT, 5038),
        username: process.env.ASTERISK_AMI_USERNAME || 'privacyapi',
        secret: process.env.ASTERISK_AMI_SECRET || 'change-this-secret',
        reconnectMs: toInt(process.env.ASTERISK_AMI_RECONNECT_MS, 5000),
        connectTimeoutMs: toInt(process.env.ASTERISK_AMI_CONNECT_TIMEOUT_MS, 8000)
      }
    },
    ops: {
      dashboardEnabled: toBool(process.env.OPS_DASHBOARD_ENABLED, true),
      allowServiceControl: toBool(process.env.OPS_ALLOW_SERVICE_CONTROL, true),
      useSudoForControl: toBool(process.env.OPS_USE_SUDO_FOR_CONTROL, true),
      commandTimeoutMs: toInt(process.env.OPS_COMMAND_TIMEOUT_MS, 8000),
      systemctlBin: process.env.OPS_SYSTEMCTL_BIN || 'systemctl',
      sudoBin: process.env.OPS_SUDO_BIN || 'sudo',
      managedServices: toList(process.env.OPS_MANAGED_SERVICES, ['asterisk', 'privacy-calling-api']),
      logs: {
        defaultLimit: toInt(process.env.OPS_LOG_DEFAULT_LIMIT, 200),
        maxLimit: toInt(process.env.OPS_LOG_MAX_LIMIT, 500),
        defaultSinceSec: toInt(process.env.OPS_LOG_DEFAULT_SINCE_SEC, 600),
        journalctlBin: process.env.OPS_JOURNALCTL_BIN || 'journalctl',
        tailBin: process.env.OPS_LOG_TAIL_BIN || 'tail',
        useSudo: toBool(process.env.OPS_LOG_USE_SUDO, false),
        includeAsteriskFull: toBool(process.env.OPS_LOG_INCLUDE_ASTERISK_FULL, true),
        asteriskFullPath: process.env.OPS_LOG_ASTERISK_FULL_PATH || '/var/log/asterisk/full'
      },
      alerts: {
        loadPerCpu: {
          warn: toNumber(process.env.OPS_ALERT_LOAD_PER_CPU_WARN, 0.8),
          error: toNumber(process.env.OPS_ALERT_LOAD_PER_CPU_ERROR, 1.2)
        },
        heapUsage: {
          warn: toNumber(process.env.OPS_ALERT_HEAP_USAGE_WARN, 0.75),
          error: toNumber(process.env.OPS_ALERT_HEAP_USAGE_ERROR, 0.9)
        },
        activeCalls: {
          warn: toInt(process.env.OPS_ALERT_ACTIVE_CALLS_WARN, 30),
          error: toInt(process.env.OPS_ALERT_ACTIVE_CALLS_ERROR, 50)
        }
      }
    }
  };
}

module.exports = {
  loadConfig
};
