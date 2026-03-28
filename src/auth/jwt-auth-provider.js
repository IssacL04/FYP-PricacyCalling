const { AuthProvider } = require('./auth-provider');
const { AuthError } = require('../utils/errors');
const { verifyJwt } = require('./jwt-utils');

class JwtAuthProvider extends AuthProvider {
  constructor(secret) {
    super();
    this.secret = String(secret || '');
  }

  parseBearer(req) {
    const raw = req.header('authorization') || req.header('Authorization');
    if (!raw) {
      return null;
    }

    const [scheme, token] = String(raw).trim().split(/\s+/, 2);
    if (!scheme || !token) {
      return null;
    }

    if (scheme.toLowerCase() !== 'bearer') {
      return null;
    }

    return token;
  }

  authenticate(req) {
    const token = this.parseBearer(req);
    if (!token) {
      throw new AuthError('Missing bearer token');
    }

    const claims = verifyJwt(token, this.secret);
    if (!claims.sub) {
      throw new AuthError('Bearer token subject is missing');
    }

    return {
      type: 'bearer_jwt',
      id: String(claims.sub),
      address: String(claims.sub),
      node_id: claims.node_id ? String(claims.node_id) : undefined,
      auth_method: claims.auth_method || 'blockchain',
      claims
    };
  }
}

module.exports = {
  JwtAuthProvider
};
