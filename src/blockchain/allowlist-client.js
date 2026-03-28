const { jsonRpcRequest } = require('./json-rpc-client');

function normalizeAddress(address) {
  return String(address || '').trim().toLowerCase();
}

class BlockchainAllowlistClient {
  constructor({
    mode = 'static',
    rpcUrl,
    contractAddress,
    chainId,
    staticAllowedAddresses = [],
    fetchFn
  }) {
    this.mode = String(mode || 'static').trim().toLowerCase();
    this.rpcUrl = rpcUrl || '';
    this.contractAddress = contractAddress || '';
    this.chainId = Number.parseInt(chainId, 10) || 0;
    this.fetchFn = fetchFn || fetch;
    this.allowedSet = new Set(
      (staticAllowedAddresses || [])
        .map(normalizeAddress)
        .filter(Boolean)
    );
  }

  async isAddressAllowed(address) {
    const normalized = normalizeAddress(address);
    if (!normalized) {
      return false;
    }

    if (this.mode === 'disabled') {
      return false;
    }

    if (this.mode === 'static') {
      return this.allowedSet.has(normalized);
    }

    if (this.mode === 'rpc_custom') {
      const result = await jsonRpcRequest({
        rpcUrl: this.rpcUrl,
        method: 'allowlist_isAllowed',
        params: [normalized, this.contractAddress, this.chainId],
        fetchFn: this.fetchFn
      });
      return Boolean(result);
    }

    throw new Error(`Unsupported allowlist mode: ${this.mode}`);
  }
}

module.exports = {
  BlockchainAllowlistClient,
  normalizeAddress
};
