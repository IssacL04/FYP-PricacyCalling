const express = require('express');
const path = require('node:path');
const os = require('node:os');
const { engsetBlockingProbability } = require('./capacity/engset');
const { privacyExhaustionProbability } = require('./capacity/privacy');
const { AppError } = require('./utils/errors');

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

function createApp({ authProvider, callService, db, amiClient, opsManager, config }) {
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
      if (!opsManager || !(config && config.ops && config.ops.dashboardEnabled)) {
        throw new AppError('Dashboard operations are disabled', 404, 'dashboard_disabled');
      }

      const [services] = await Promise.all([
        opsManager.getServicesStatus()
      ]);

      const dbState = db.healthCheck();
      const amiState = amiClient.status();
      const summary = db.getDashboardSummary();
      const recentCalls = db.getRecentCalls(10);
      const mem = process.memoryUsage();

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
        capabilities: {
          allow_service_control: Boolean(config.ops.allowServiceControl),
          managed_services: opsManager.listManagedServices()
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/v1/ops/services', async (req, res, next) => {
    try {
      if (!opsManager || !(config && config.ops && config.ops.dashboardEnabled)) {
        throw new AppError('Dashboard operations are disabled', 404, 'dashboard_disabled');
      }

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
      if (!opsManager || !(config && config.ops && config.ops.dashboardEnabled)) {
        throw new AppError('Dashboard operations are disabled', 404, 'dashboard_disabled');
      }

      const serviceStatus = await opsManager.controlService(req.params.service, req.params.action);
      res.json({
        status: 'ok',
        service: serviceStatus
      });
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
  createApp
};
