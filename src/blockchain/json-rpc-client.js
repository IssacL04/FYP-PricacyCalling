let rpcRequestId = 1;

async function jsonRpcRequest({ rpcUrl, method, params = [], fetchFn = fetch }) {
  if (!rpcUrl) {
    throw new Error('rpcUrl is required');
  }

  const id = rpcRequestId;
  rpcRequestId += 1;

  const response = await fetchFn(rpcUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`RPC request failed (${response.status})`);
  }

  const payload = await response.json();
  if (payload.error) {
    const detail = payload.error && payload.error.message ? payload.error.message : 'unknown rpc error';
    throw new Error(`${method} failed: ${detail}`);
  }

  return payload.result;
}

module.exports = {
  jsonRpcRequest
};
