const express = require('express');
const path = require('node:path');
const os = require('node:os');
const { engsetBlockingProbability } = require('./capacity/engset');
const { privacyExhaustionProbability } = require('./capacity/privacy');
const { buildOpsMetricsAndAlerts } = require('./services/ops-metrics');
const { AppError } = require('./utils/errors');

const AUDIT_ACTION_ALLOW_LIST = new Set([
  'logs_tail_paused',
  'logs_tail_resumed',
  'logs_export_json',
  'logs_manual_refresh',
  'logs_filters_updated'
]);

function parseNumber(name, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${name} must be a number`, 400, 'invalid_capacity_input');
  }
  return parsed;
}

function toMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function parseLimit(value, fallback = 30, max = 200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, parsed));
}

function getPrincipalId(req) {
  return req && req.principal && req.principal.id ? req.principal.id : 'unknown';
}

function ensureOpsEnabled({ opsManager, config }) {
  if (!opsManager || !(config && config.ops && config.ops.dashboardEnabled)) {
    throw new AppError('Dashboard operations are disabled', 404, 'dashboard_disabled');
  }
}

function maybeWriteAudit(db, payload) {
  if (!db || typeof db.addOpsAuditEvent !== 'function') {
    return;
  }

  db.addOpsAuditEvent(payload);
}

function createApp({ authProvider, callService, db, amiClient, opsManager, opsLogService, config }) {
  const app = express();
  app.use(express.json());
  app.use('/dashboard', express.static(path.join(__dirname, 'web'), { index: 'index.html' }));

  app.get('/health', (req, res) => {
    const dbState = db.healthCheck();
    const amiState = amiClient.status();
    res.json({
      status: 'ok',
      db: dbState.ok === 1 ? 'ok' : 'error',
      ami: amiState,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/', (req, res) => {
    res.redirect('/dashboard');
  });

  app.use('/v1', (req, res, next) => {
    try {
      req.principal = authProvider.authenticate(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/ops/overview', async (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });

      const [services] = await Promise.all([
        opsManager.getServicesStatus()
      ]);

      const dbState = db.healthCheck();
      const amiState = amiClient.status();
      const summary = db.getDashboardSummary();
      const recentCalls = db.getRecentCalls(10);
      const mem = process.memoryUsage();
      const metricsBundle = buildOpsMetricsAndAlerts({
        summary,
        memoryUsage: mem,
        loadavg: os.loadavg(),
        cpuCount: os.cpus().length,
        totalMem: os.totalmem(),
        freeMem: os.freemem(),
        thresholds: config && config.ops ? config.ops.alerts : null
      });

      res.json({
        status: 'ok',
        generated_at: new Date().toISOString(),
        host: os.hostname(),
        uptime_sec: Math.round(process.uptime()),
        memory: {
          rss_mb: toMb(mem.rss),
          heap_used_mb: toMb(mem.heapUsed),
          heap_total_mb: toMb(mem.heapTotal)
        },
        health: {
          api: 'ok',
          db: dbState.ok === 1 ? 'ok' : 'error',
          ami: amiState
        },
        services,
        database: summary,
        recent_calls: recentCalls,
        system: metricsBundle.system,
        metrics: metricsBundle.metrics,
        thresholds: metricsBundle.thresholds,
        alerts: metricsBundle.alerts,
        capabilities: {
          allow_service_control: Boolean(config.ops.allowServiceControl),
          managed_services: opsManager.listManagedServices(),
          log_services: opsLogService ? opsLogService.listManagedServices() : []
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/ops/logs', async (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });
      if (!opsLogService) {
        throw new AppError('Ops log service is unavailable', 503, 'ops_log_service_unavailable');
      }

      const payload = await opsLogService.getLogs({
        services: req.query.services,
        levels: req.query.levels,
        sinceSec: req.query.since_sec,
        limit: req.query.limit
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/ops/audit-events', (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });
      if (!db || typeof db.listOpsAuditEvents !== 'function') {
        throw new AppError('Audit store is unavailable', 503, 'audit_store_unavailable');
      }

      const limit = parseLimit(req.query.limit, 30, 200);
      res.json({
        events: db.listOpsAuditEvents(limit),
        limit
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/ops/audit-events', (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });
      if (!db || typeof db.addOpsAuditEvent !== 'function') {
        throw new AppError('Audit store is unavailable', 503, 'audit_store_unavailable');
      }

      const action = req.body && typeof req.body.action === 'string'
        ? req.body.action.trim()
        : '';
      if (!AUDIT_ACTION_ALLOW_LIST.has(action)) {
        throw new AppError('Unsupported audit action', 400, 'unsupported_audit_action');
      }

      const target = req.body && typeof req.body.target === 'string' && req.body.target.trim()
        ? req.body.target.trim()
        : 'dashboard';
      const resultRaw = req.body && typeof req.body.result === 'string'
        ? req.body.result.trim().toLowerCase()
        : 'success';
      const result = ['success', 'failed', 'info'].includes(resultRaw)
        ? resultRaw
        : 'info';

      const details = req.body && req.body.details && typeof req.body.details === 'object'
        ? req.body.details
        : null;

      maybeWriteAudit(db, {
        actor: getPrincipalId(req),
        action,
        target,
        result,
        details
      });

      res.status(201).json({
        status: 'ok'
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/ops/services', async (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });

      const services = await opsManager.getServicesStatus();
      res.json({
        services
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/ops/services/:service/:action', async (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });

      const actor = getPrincipalId(req);
      const actionName = String(req.params.action || '').trim();
      const serviceName = String(req.params.service || '').trim();

      try {
        const serviceStatus = await opsManager.controlService(serviceName, actionName);
        maybeWriteAudit(db, {
          actor,
          action: `service_${actionName}`,
          target: serviceName,
          result: 'success',
          details: {
            active_state: serviceStatus.active_state,
            sub_state: serviceStatus.sub_state
          }
        });

        res.json({
          status: 'ok',
          service: serviceStatus
        });
      } catch (error) {
        try {
          maybeWriteAudit(db, {
            actor,
            action: `service_${actionName}`,
            target: serviceName,
            result: 'failed',
            details: {
              code: error.code || 'service_control_failed',
              message: error.message
            }
          });
        } catch (auditError) {
          // ignore audit write errors to avoid shadowing the original error
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/calls', async (req, res, next) => {
    try {
      const { caller_user_id: callerUserId, callee_e164: calleeE164, timeout_sec: timeoutSec } = req.body || {};
      if (!callerUserId || !calleeE164) {
        throw new AppError('caller_user_id and callee_e164 are required', 400, 'invalid_payload');
      }

      const result = await callService.createCall({
        callerUserId,
        calleeE164,
        timeoutSec,
        requestedBy: req.principal.id
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/calls/:id', (req, res, next) => {
    try {
      const found = callService.getCall(req.params.id);
      res.json(found);
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/capacity/engset', (req, res, next) => {
    try {
      const N = Number.parseInt(req.query.N, 10);
      const C = Number.parseInt(req.query.C, 10);
      const beta = parseNumber('beta', req.query.beta);
      const probability = engsetBlockingProbability({ N, C, beta });
      res.json({
        blocking_probability: probability,
        inputs: { N, C, beta }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/capacity/privacy-exhaustion', (req, res, next) => {
    try {
      const N = Number.parseInt(req.query.N, 10);
      const M = Number.parseInt(req.query.M, 10);
      const p = parseNumber('p', req.query.p);
      const probability = privacyExhaustionProbability({ N, p, M });
      res.json({
        failure_probability: probability,
        inputs: { N, p, M }
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status = error.status || 500;
    const payload = {
      error: {
        code: error.code || 'internal_error',
        message: error.message || 'Internal error'
      }
    };

    if (error.details) {
      payload.error.details = error.details;
    }

    return res.status(status).json(payload);
  });

  return app;
}

module.exports = {
  createApp,
  AUDIT_ACTION_ALLOW_LIST
};
