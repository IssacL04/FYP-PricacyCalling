const net = require('net');
const { EventEmitter } = require('events');

function generateActionId() {
  return `act-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseMessage(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const message = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    message[key] = value;
  }

  return message;
}

class AmiClient extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.socket = null;
    this.buffer = '';
    this.connected = false;
    this.authenticated = false;
    this.manualClose = false;
    this.pendingActions = new Map();
    this.reconnectTimer = null;
  }

  async start() {
    await this.connect();
  }

  stop() {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.connected = false;
    this.authenticated = false;
  }

  status() {
    return {
      connected: this.connected,
      authenticated: this.authenticated
    };
  }

  async connect() {
    if (this.connected) {
      return;
    }

    this.manualClose = false;

    await new Promise((resolve, reject) => {
      const socket = net.createConnection(
        {
          host: this.options.host,
          port: this.options.port
        },
        () => {
          this.socket = socket;
          this.connected = true;
          resolve();
        }
      );

      const timeout = setTimeout(() => {
        socket.destroy(new Error('AMI connection timeout'));
      }, this.options.connectTimeoutMs);

      socket.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.on('connect', () => {
        clearTimeout(timeout);
      });
    });

    this.attachSocketHandlers(this.socket);

    const login = await this.sendAction({
      Action: 'Login',
      Username: this.options.username,
      Secret: this.options.secret,
      Events: 'on'
    });

    if (login.Response !== 'Success') {
      throw new Error(`AMI login failed: ${login.Message || login.Response}`);
    }

    this.authenticated = true;
  }

  attachSocketHandlers(socket) {
    socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this.consumeFrames();
    });

    socket.on('close', () => {
      this.connected = false;
      this.authenticated = false;
      this.rejectPendingActions(new Error('AMI socket closed'));
      this.emit('disconnect');

      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });

    socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.manualClose) {
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        this.emit('reconnect');
      } catch (err) {
        this.emit('error', err);
        this.scheduleReconnect();
      }
    }, this.options.reconnectMs);
  }

  consumeFrames() {
    // AMI frames are separated by blank lines.
    while (true) {
      let separator = this.buffer.indexOf('\r\n\r\n');
      let sepLen = 4;
      if (separator === -1) {
        separator = this.buffer.indexOf('\n\n');
        sepLen = 2;
      }
      if (separator === -1) {
        break;
      }

      const frame = this.buffer.slice(0, separator);
      this.buffer = this.buffer.slice(separator + sepLen);
      if (!frame.trim()) {
        continue;
      }

      const message = parseMessage(frame);
      this.handleMessage(message);
    }
  }

  handleMessage(message) {
    if (message.ActionID && this.pendingActions.has(message.ActionID) && message.Response) {
      const pending = this.pendingActions.get(message.ActionID);
      this.pendingActions.delete(message.ActionID);
      clearTimeout(pending.timer);
      pending.resolve(message);
      return;
    }

    if (message.Event) {
      this.emit('event', message);
      return;
    }

    if (message.Response && message.Message && /Authentication accepted/i.test(message.Message)) {
      this.emit('authenticated', message);
    }
  }

  rejectPendingActions(error) {
    for (const pending of this.pendingActions.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingActions.clear();
  }

  sendAction(action) {
    if (!this.connected || !this.socket) {
      return Promise.reject(new Error('AMI is not connected'));
    }

    const payload = { ...action };
    if (!payload.ActionID) {
      payload.ActionID = generateActionId();
    }

    const lines = [];
    for (const [key, value] of Object.entries(payload)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          lines.push(`${key}: ${item}`);
        }
      } else if (value !== undefined && value !== null) {
        lines.push(`${key}: ${value}`);
      }
    }

    const data = `${lines.join('\r\n')}\r\n\r\n`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingActions.delete(payload.ActionID);
        reject(new Error(`AMI action timeout: ${payload.Action}`));
      }, 10000);

      this.pendingActions.set(payload.ActionID, { resolve, reject, timer });

      this.socket.write(data, (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingActions.delete(payload.ActionID);
          reject(err);
        }
      });
    });
  }
}

module.exports = {
  AmiClient
};
