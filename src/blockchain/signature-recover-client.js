const { jsonRpcRequest } = require('./json-rpc-client');
const { normalizeAddress } = require('./allowlist-client');

class SignatureRecoverClient {
  constructor({ rpcUrl, fetchFn }) {
    this.rpcUrl = rpcUrl || '';
    this.fetchFn = fetchFn || fetch;
  }

  async recoverAddress({ message, signature }) {
    const recovered = await jsonRpcRequest({
      rpcUrl: this.rpcUrl,
      method: 'personal_ecRecover',
      params: [String(message || ''), String(signature || '')],
      fetchFn: this.fetchFn
    });

    return normalizeAddress(recovered);
  }
}

module.exports = {
  SignatureRecoverClient
};
