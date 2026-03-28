const { loadConfig } = require('./config');
const { DatabaseService } = require('./db');
const { ApiKeyAuthProvider } = require('./auth/api-key-auth-provider');
const { JwtAuthProvider } = require('./auth/jwt-auth-provider');
const { HybridAuthProvider } = require('./auth/hybrid-auth-provider');
const { ChallengeStore } = require('./auth/challenge-store');
const { BlockchainAuthService } = require('./auth/blockchain-auth-service');
const { ConsistentCalleePolicy } = require('./policy/consistent-callee-policy');
const { AmiClient } = require('./asterisk/ami-client');
const { BlockchainAllowlistClient } = require('./blockchain/allowlist-client');
const { SignatureRecoverClient } = require('./blockchain/signature-recover-client');
const { CallStateMachine } = require('./services/call-state-machine');
const { CallService } = require('./services/call-service');
const { SystemServiceManager } = require('./services/system-service-manager');
const { OpsLogService } = require('./services/ops-log-service');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  const db = new DatabaseService(config.db.path);
  const apiKeyAuthProvider = new ApiKeyAuthProvider(config.app.apiKey);
  let authProvider = apiKeyAuthProvider;
  let blockchainAuthService = null;
  const shouldEnableJwtFlow = config.auth.mode === 'hybrid'
    || config.auth.mode === 'blockchain'
    || config.auth.demoMode;

  if (shouldEnableJwtFlow) {
    const jwtAuthProvider = new JwtAuthProvider(config.auth.jwtSecret);
    const challengeStore = new ChallengeStore({
      ttlSec: config.auth.challengeTtlSec
    });
    const allowlistClient = new BlockchainAllowlistClient({
      mode: config.blockchain.allowlistMode,
      rpcUrl: config.blockchain.rpcUrl,
      contractAddress: config.blockchain.allowlistContract,
      chainId: config.blockchain.chainId,
      staticAllowedAddresses: config.blockchain.allowedAddresses
    });
    const signatureRecoverClient = new SignatureRecoverClient({
      rpcUrl: config.blockchain.rpcUrl
    });

    blockchainAuthService = new BlockchainAuthService({
      challengeStore,
      allowlistClient,
      signatureRecoverClient,
      jwtSecret: config.auth.jwtSecret,
      jwtExpiresSec: config.auth.jwtExpiresSec,
      challengeTtlSec: config.auth.challengeTtlSec,
      serverOrigin: `${config.app.host}:${config.app.port}`
    });

    let enableApiKeyFallback = false;
    if (config.auth.mode === 'hybrid') {
      enableApiKeyFallback = config.auth.enableApiKeyFallback;
    } else if (config.auth.mode === 'api_key' && config.auth.demoMode) {
      // In demo mode, keep API key as the default auth path but allow demo bearer token.
      enableApiKeyFallback = true;
    }

    authProvider = new HybridAuthProvider({
      jwtProvider: jwtAuthProvider,
      apiKeyProvider: apiKeyAuthProvider,
      enableApiKeyFallback
    });
  }
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

  const opsLogService = new OpsLogService({
    managedServices: config.ops.managedServices,
    defaultLimit: config.ops.logs.defaultLimit,
    maxLimit: config.ops.logs.maxLimit,
    defaultSinceSec: config.ops.logs.defaultSinceSec,
    commandTimeoutMs: config.ops.commandTimeoutMs,
    journalctlBin: config.ops.logs.journalctlBin,
    tailBin: config.ops.logs.tailBin,
    sudoBin: config.ops.sudoBin,
    useSudo: config.ops.logs.useSudo,
    includeAsteriskFull: config.ops.logs.includeAsteriskFull,
    asteriskFullPath: config.ops.logs.asteriskFullPath
  });

  const app = createApp({
    authProvider,
    blockchainAuthService,
    callService,
    db,
    amiClient,
    opsManager,
    opsLogService,
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
