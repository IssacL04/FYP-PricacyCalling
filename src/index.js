const { loadConfig } = require('./config');
const { DatabaseService } = require('./db');
const { ApiKeyAuthProvider } = require('./auth/api-key-auth-provider');
const { ConsistentCalleePolicy } = require('./policy/consistent-callee-policy');
const { AmiClient } = require('./asterisk/ami-client');
const { CallStateMachine } = require('./services/call-state-machine');
const { CallService } = require('./services/call-service');
const { SystemServiceManager } = require('./services/system-service-manager');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  const db = new DatabaseService(config.db.path);
  const authProvider = new ApiKeyAuthProvider(config.app.apiKey);
  const identityPolicy = new ConsistentCalleePolicy(db);
  const callStateMachine = new CallStateMachine(db);

  const amiClient = new AmiClient(config.asterisk.ami);
  amiClient.on('event', (event) => {
    try {
      callStateMachine.processEvent(event);
    } catch (err) {
      // Avoid crashing the process because of one malformed AMI event.
      // eslint-disable-next-line no-console
      console.error('[AMI EVENT ERROR]', err.message);
    }
  });
  amiClient.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[AMI ERROR]', err.message);
  });
  amiClient.on('reconnect', () => {
    // eslint-disable-next-line no-console
    console.log('[AMI] reconnected');
  });

  try {
    await amiClient.start();
    // eslint-disable-next-line no-console
    console.log('[AMI] connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[AMI] startup connection failed: ${err.message}`);
  }

  const callService = new CallService({
    db,
    amiClient,
    identityPolicy,
    callStateMachine,
    config
  });

  const opsManager = new SystemServiceManager({
    managedServices: config.ops.managedServices,
    allowServiceControl: config.ops.allowServiceControl,
    useSudoForControl: config.ops.useSudoForControl,
    commandTimeoutMs: config.ops.commandTimeoutMs,
    systemctlBin: config.ops.systemctlBin,
    sudoBin: config.ops.sudoBin
  });

  const app = createApp({
    authProvider,
    callService,
    db,
    amiClient,
    opsManager,
    config
  });
  const server = app.listen(config.app.port, config.app.host, () => {
    // eslint-disable-next-line no-console
    console.log(`privacy-calling-api listening on ${config.app.host}:${config.app.port}`);
  });

  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log('Shutting down...');
    server.close(() => {
      try {
        amiClient.stop();
      } finally {
        db.close();
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
