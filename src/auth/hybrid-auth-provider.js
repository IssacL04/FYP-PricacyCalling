const { AuthProvider } = require('./auth-provider');
const { AuthError } = require('../utils/errors');

class HybridAuthProvider extends AuthProvider {
  constructor({ jwtProvider, apiKeyProvider, enableApiKeyFallback = true }) {
    super();
    this.jwtProvider = jwtProvider;
    this.apiKeyProvider = apiKeyProvider;
    this.enableApiKeyFallback = Boolean(enableApiKeyFallback);
  }

  hasBearer(req) {
    const raw = req.header('authorization') || req.header('Authorization');
    if (!raw) {
      return false;
    }
    const [scheme] = String(raw).trim().split(/\s+/, 1);
    return Boolean(scheme && scheme.toLowerCase() === 'bearer');
  }

  authenticate(req) {
    if (this.jwtProvider && this.hasBearer(req)) {
      return this.jwtProvider.authenticate(req);
    }

    if (this.enableApiKeyFallback && this.apiKeyProvider) {
      return this.apiKeyProvider.authenticate(req);
    }

    throw new AuthError('Authentication required');
  }
}

module.exports = {
  HybridAuthProvider
};
