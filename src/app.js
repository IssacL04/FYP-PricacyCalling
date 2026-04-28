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
  'logs_filters_updated',
  'ai_diagnostics_requested',
  'messages_manual_refresh',
  'messages_filters_updated',
  'messages_export_json'
]);

const MESSAGE_STATUS_ALLOW_LIST = new Set(['created', 'routing', 'delivered', 'failed']);

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

function evaluateServiceLevel(service) {
  if (!service || !service.active_state) {
    return 'unknown';
  }
  if (service.active_state === 'active') {
    return 'healthy';
  }
  if (service.active_state === 'activating' || service.active_state === 'deactivating') {
    return 'degraded';
  }
  return 'critical';
}

function severityRank(level) {
  if (level === 'critical' || level === 'error') {
    return 3;
  }
  if (level === 'degraded' || level === 'warning') {
    return 2;
  }
  if (level === 'healthy' || level === 'ok' || level === 'info') {
    return 1;
  }
  return 0;
}

function maxSeverity(...levels) {
  return levels.reduce((current, next) => (
    severityRank(next) > severityRank(current) ? next : current
  ), 'healthy');
}

function buildOpsPrecheck({ overview, logs }) {
  const services = Array.isArray(overview && overview.services) ? overview.services : [];
  const alerts = Array.isArray(overview && overview.alerts) ? overview.alerts : [];
  const logEntries = Array.isArray(logs && logs.entries) ? logs.entries : [];
  const health = (overview && overview.health) || {};

  const findings = [];
  const healthLevels = [];

  if (health.db && health.db !== 'ok') {
    findings.push({
      level: 'error',
      title: '数据库健康检查异常',
      detail: `DB health=${health.db}`
    });
    healthLevels.push('critical');
  }

  if (health.ami && (!health.ami.connected || !health.ami.authenticated)) {
    findings.push({
      level: 'error',
      title: 'AMI 连接异常',
      detail: `connected=${Boolean(health.ami.connected)}, authenticated=${Boolean(health.ami.authenticated)}`
    });
    healthLevels.push('critical');
  }

  for (const service of services) {
    const serviceLevel = evaluateServiceLevel(service);
    healthLevels.push(serviceLevel);
    if (serviceLevel !== 'healthy') {
      findings.push({
        level: serviceLevel === 'critical' ? 'error' : 'warning',
        title: `服务状态异常: ${service.id || 'unknown'}`,
        detail: `${service.active_state || 'unknown'}:${service.sub_state || 'unknown'}`
      });
    }
  }

  for (const alert of alerts) {
    healthLevels.push(alert.level === 'error' ? 'critical' : 'degraded');
    findings.push({
      level: alert.level === 'error' ? 'error' : 'warning',
      title: `指标告警: ${alert.metric || alert.id || 'unknown'}`,
      detail: alert.message || ''
    });
  }

  const errorLogCount = logEntries.filter((entry) => entry.level === 'error').length;
  const warningLogCount = logEntries.filter((entry) => entry.level === 'warning').length;
  if (errorLogCount > 0) {
    healthLevels.push('critical');
    findings.push({
      level: 'error',
      title: '近期日志包含 error',
      detail: `${errorLogCount} 条 error 日志`
    });
  } else if (warningLogCount > 0) {
    healthLevels.push('degraded');
    findings.push({
      level: 'warning',
      title: '近期日志包含 warning',
      detail: `${warningLogCount} 条 warning 日志`
    });
  }

  const overallStatus = maxSeverity(...healthLevels);
  return {
    overall_status: overallStatus === 'critical'
      ? 'critical'
      : overallStatus === 'degraded'
        ? 'degraded'
        : 'healthy',
    findings,
    counters: {
      services: services.length,
      alerts: alerts.length,
      logs: logEntries.length,
      error_logs: errorLogCount,
      warning_logs: warningLogCount
    }
  };
}

async function buildOpsOverviewSnapshot({
  db,
  amiClient,
  opsManager,
  opsLogService,
  llmDiagnosticsService,
  config
}) {
  const [services] = await Promise.all([
    opsManager.getServicesStatus()
  ]);

  const dbState = db.healthCheck();
  const amiState = amiClient.status();
  const summary = db.getDashboardSummary();
  const recentCalls = db.getRecentCalls(10);
  const recentMessages = typeof db.getRecentMessages === 'function'
    ? db.getRecentMessages(10)
    : [];
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
  const aiDiagnosticsConfig = llmDiagnosticsService
    && typeof llmDiagnosticsService.getPublicConfig === 'function'
    ? llmDiagnosticsService.getPublicConfig()
    : null;

  return {
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
    recent_messages: recentMessages,
    system: metricsBundle.system,
    metrics: metricsBundle.metrics,
    thresholds: metricsBundle.thresholds,
    alerts: metricsBundle.alerts,
    capabilities: {
      allow_service_control: Boolean(config.ops.allowServiceControl),
      managed_services: opsManager.listManagedServices(),
      log_services: opsLogService ? opsLogService.listManagedServices() : [],
      ai_diagnostics: aiDiagnosticsConfig || {
        enabled: false,
        configured: false,
        provider: '',
        model: ''
      }
    }
  };
}

function maybeWriteAudit(db, payload) {
  if (!db || typeof db.addOpsAuditEvent !== 'function') {
    return;
  }

  db.addOpsAuditEvent(payload);
}

function createApp({
  authProvider,
  blockchainAuthService,
  callService,
  db,
  amiClient,
  opsManager,
  opsLogService,
  llmDiagnosticsService,
  config
}) {
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

  app.get('/v1/auth/challenge', (req, res, next) => {
    try {
      if (!blockchainAuthService) {
        throw new AppError('Blockchain auth is disabled', 404, 'blockchain_auth_disabled');
      }

      const address = req.query && req.query.address ? String(req.query.address).trim() : '';
      const nodeId = req.query && req.query.node_id ? String(req.query.node_id).trim() : '';
      const payload = blockchainAuthService.createChallenge({
        address,
        nodeId
      });

      res.json({
        status: 'ok',
        ...payload
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/auth/verify', async (req, res, next) => {
    try {
      if (!blockchainAuthService) {
        throw new AppError('Blockchain auth is disabled', 404, 'blockchain_auth_disabled');
      }

      const payload = await blockchainAuthService.verifyChallenge({
        address: req.body && req.body.address,
        nodeId: req.body && req.body.node_id,
        challengeId: req.body && req.body.challenge_id,
        signature: req.body && req.body.signature
      });

      res.json({
        status: 'ok',
        ...payload
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/auth/demo-login', (req, res, next) => {
    try {
      if (!(config && config.auth && config.auth.demoMode)) {
        throw new AppError('Demo auth is disabled', 404, 'auth_demo_disabled');
      }
      if (!blockchainAuthService || typeof blockchainAuthService.createDemoSession !== 'function') {
        throw new AppError('Demo auth requires AUTH_MODE=hybrid or blockchain', 400, 'auth_mode_not_supported');
      }

      const address = req.body && req.body.address
        ? String(req.body.address).trim()
        : String(config.auth.demoAddress || '').trim();
      const nodeId = req.body && req.body.node_id
        ? String(req.body.node_id).trim()
        : String(config.auth.demoNodeId || '').trim();

      const payload = blockchainAuthService.createDemoSession({
        address,
        nodeId
      });

      res.json({
        status: 'ok',
        demo_mode: true,
        ...payload
      });
    } catch (error) {
      next(error);
    }
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

      const overview = await buildOpsOverviewSnapshot({
        db,
        amiClient,
        opsManager,
        opsLogService,
        llmDiagnosticsService,
        config
      });

      res.json(overview);
    } catch (error) {
      next(error);
    }
  });

  app.post('/v1/ops/diagnostics', async (req, res, next) => {
    try {
      ensureOpsEnabled({ opsManager, config });
      if (!opsLogService) {
        throw new AppError('Ops log service is unavailable', 503, 'ops_log_service_unavailable');
      }
      if (!llmDiagnosticsService || typeof llmDiagnosticsService.analyze !== 'function') {
        throw new AppError('AI diagnostics service is unavailable', 503, 'llm_diagnostics_unavailable');
      }

      const actor = getPrincipalId(req);
      const logLimit = parseLimit(
        req.body && req.body.log_limit,
        config && config.llm ? config.llm.diagnosticLogLimit : 120,
        300
      );
      const sinceSecRaw = Number.parseInt(req.body && req.body.since_sec, 10);
      const sinceSec = Number.isFinite(sinceSecRaw) && sinceSecRaw > 0
        ? Math.min(sinceSecRaw, 24 * 3600)
        : (config && config.llm ? config.llm.diagnosticLogSinceSec : 900);
      const logServices = req.body && req.body.services
        ? req.body.services
        : undefined;
      const logLevels = req.body && req.body.levels
        ? req.body.levels
        : 'warning,error';

      const [overview, logs, auditEvents] = await Promise.all([
        buildOpsOverviewSnapshot({
          db,
          amiClient,
          opsManager,
          opsLogService,
          llmDiagnosticsService,
          config
        }),
        opsLogService.getLogs({
          services: logServices,
          levels: logLevels,
          sinceSec,
          limit: logLimit
        }),
        db && typeof db.listOpsAuditEvents === 'function'
          ? Promise.resolve(db.listOpsAuditEvents(20))
          : Promise.resolve([])
      ]);

      const precheck = buildOpsPrecheck({ overview, logs });
      const snapshot = {
        collected_at: new Date().toISOString(),
        actor,
        precheck,
        overview,
        logs,
        audit_events: auditEvents
      };

      try {
        const result = await llmDiagnosticsService.analyze(snapshot);
        maybeWriteAudit(db, {
          actor,
          action: 'ai_diagnostics_requested',
          target: 'dashboard.ai_diagnostics',
          result: 'success',
          details: {
            overall_status: result.diagnosis && result.diagnosis.overall_status,
            confidence: result.diagnosis && result.diagnosis.confidence,
            model: result.analyzer && result.analyzer.model,
            log_entries: logs.entries.length
          }
        });

        res.json({
          status: 'ok',
          generated_at: result.generated_at,
          precheck,
          analyzer: result.analyzer,
          diagnosis: result.diagnosis,
          logs_warnings: logs.warnings,
          usage: result.usage,
          raw_response_parseable: result.raw_response_parseable
        });
      } catch (error) {
        try {
          maybeWriteAudit(db, {
            actor,
            action: 'ai_diagnostics_requested',
            target: 'dashboard.ai_diagnostics',
            result: 'failed',
            details: {
              code: error.code || 'llm_diagnostics_failed',
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

  app.get('/v1/messages', (req, res, next) => {
    try {
      if (!db || typeof db.listMessages !== 'function') {
        throw new AppError('Message store is unavailable', 503, 'message_store_unavailable');
      }

      const limit = parseLimit(req.query.limit, 30, 200);
      const statusRaw = req.query && req.query.status
        ? String(req.query.status).trim().toLowerCase()
        : '';
      const status = statusRaw || null;
      if (status && !MESSAGE_STATUS_ALLOW_LIST.has(status)) {
        throw new AppError('Unsupported message status filter', 400, 'invalid_message_status');
      }

      const sinceSecRaw = Number.parseInt(req.query.since_sec, 10);
      const sinceSec = Number.isFinite(sinceSecRaw) && sinceSecRaw > 0
        ? Math.min(sinceSecRaw, 7 * 24 * 3600)
        : null;

      const messages = db.listMessages({
        limit,
        status,
        sinceSec
      });

      res.json({
        messages,
        limit,
        status,
        since_sec: sinceSec
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/messages/:id', (req, res, next) => {
    try {
      if (!db || typeof db.getMessageById !== 'function') {
        throw new AppError('Message store is unavailable', 503, 'message_store_unavailable');
      }

      const found = db.getMessageById(req.params.id);
      if (!found) {
        throw new AppError('message not found', 404, 'message_not_found');
      }
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
