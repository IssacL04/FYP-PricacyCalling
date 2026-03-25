const { AuthProvider } = require('./auth-provider');
const { AuthError } = require('../utils/errors');

class ApiKeyAuthProvider extends AuthProvider {
  constructor(expectedApiKey) {
    super();
    this.expectedApiKey = expectedApiKey;
  }

  authenticate(req) {
    const apiKey = req.header('x-api-key');
    if (!apiKey || apiKey !== this.expectedApiKey) {
      throw new AuthError('Invalid API key');
    }

    return {
      type: 'api_key',
      id: 'static-api-key'
    };
  }
}

module.exports = {
  ApiKeyAuthProvider
};
