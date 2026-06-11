// checkmyapp — WebSocket tunnel client
import http from 'node:http';
import { WebSocket } from 'ws';
import { get } from './config.js';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RESPONSE_BODY_BYTES = 1_048_576; // 1 MB

export default class TunnelClient {
  /**
   * @param {object} options
   * @param {number} options.localPort - The local dev server port
   * @param {string} [options.token] - Auth token (defaults to config)
   * @param {string} [options.serverUrl] - Server URL (defaults to config)
   * @param {boolean} [options.quiet] - Suppress info logs
   */
  constructor(options = {}) {
    this.localPort = options.localPort;
    this.token = options.token || get('authToken') || '';
    this.serverUrl = options.serverUrl || get('serverUrl') || 'http://localhost:3000';
    this.quiet = !!options.quiet;

    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.intentionalClose = false;
    this.assignedSubdomain = null;
  }

  /**
   * Get the WebSocket URL by replacing http(s):// with ws(s)://.
   * @returns {string}
   */
  _getWsUrl() {
    return this.serverUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  }

  /**
   * Connect to the tunnel server and start the session.
   * @returns {Promise<void>}
   */
  async connect() {
    this.intentionalClose = false;
    const wsUrl = this._getWsUrl();

    if (!this.quiet) {
      console.log(`🔌 Connecting to tunnel server: ${wsUrl}`);
    }

    this.ws = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      const onOpen = () => {
        if (!this.quiet) console.log('✅ WebSocket connected');
        this._sendRegister();
        this._startHeartbeat();
        this.reconnectAttempts = 0;
        resolve();
      };

      const onError = (err) => {
        if (!this.quiet) console.error('❌ WebSocket error:', err.message);
        reject(err);
      };

      const onClose = () => {
        this._stopHeartbeat();
        if (!this.intentionalClose) {
          this._scheduleReconnect();
        }
      };

      const onMessage = (data) => {
        this._handleMessage(data);
      };

      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
      this.ws.on('close', onClose);
      this.ws.on('message', onMessage);

      // Timeout if connection doesn't open within 15s
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timed out'));
        }
      }, 15_000);
    });
  }

  /**
   * Send the 'register' message to the server.
   */
  _sendRegister() {
    this._send({
      type: 'register',
      token: this.token,
      localPort: this.localPort,
    });
  }

  /**
   * Send a JSON message over the WebSocket.
   * @param {object} msg
   */
  _send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Handle an incoming message from the server.
   * @param {Buffer|string} raw
   */
  _handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed messages
    }

    switch (msg.type) {
      case 'assigned': {
        this.assignedSubdomain = msg.subdomain || msg.url || 'unknown';
        const publicUrl = msg.url || `https://${this.assignedSubdomain}.checkmyapp.dev`;
        if (!this.quiet) {
          console.log(`🌍 Tunnel established!`);
          console.log(`   Public URL: ${publicUrl}`);
        }
        break;
      }

      case 'request': {
        this._handleProxyRequest(msg);
        break;
      }

      case 'bandwidth_update': {
        if (!this.quiet) {
          const used = msg.bytesUsed || 0;
          const limit = msg.bytesLimit || 'unlimited';
          console.log(`📊 Bandwidth: ${_formatBytes(used)} / ${typeof limit === 'number' ? _formatBytes(limit) : limit}`);
        }
        break;
      }

      case 'session_expired': {
        console.log('⏰ Session expired. Please re-authenticate.');
        this.intentionalClose = true;
        this.disconnect();
        process.exit(1);
        break;
      }

      case 'pong': {
        // heartbeat acknowledged — nothing to do
        break;
      }

      case 'error': {
        if (!this.quiet) {
          console.error(`⚠️  Server error: ${msg.message || 'unknown'}`);
        }
        break;
      }

      default: {
        // unknown message type — ignore
      }
    }
  }

  /**
   * Proxy an incoming HTTP request to the local dev server.
   * @param {object} msg - The request message from the server
   */
  _handleProxyRequest(msg) {
    const requestId = msg.requestId;
    const method = msg.method || 'GET';
    const path = msg.path || '/';
    const headers = msg.headers || {};
    const body = msg.body ? Buffer.from(msg.body, 'base64') : null;

    const options = {
      hostname: '127.0.0.1',
      port: this.localPort,
      path,
      method,
      headers: { ...headers },
    };

    // Remove hop-by-hop headers
    delete options.headers['connection'];
    delete options.headers['keep-alive'];
    delete options.headers['transfer-encoding'];

    const proxyReq = http.request(options, (proxyRes) => {
      const chunks = [];
      let totalBytes = 0;

      proxyRes.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes <= MAX_RESPONSE_BODY_BYTES) {
          chunks.push(chunk);
        }
      });

      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(chunks);
        const responseBodyB64 = responseBody.toString('base64');

        this._send({
          type: 'response',
          requestId,
          statusCode: proxyRes.statusCode,
          headers: proxyRes.headers,
          body: responseBodyB64,
          truncated: totalBytes > MAX_RESPONSE_BODY_BYTES,
        });
      });

      proxyRes.on('error', (err) => {
        this._sendErrorResponse(requestId, 502, err.message);
      });
    });

    proxyReq.on('error', (err) => {
      this._sendErrorResponse(requestId, 502, err.message);
    });

    if (body) {
      proxyReq.write(body);
    }

    proxyReq.end();
  }

  /**
   * Send an error response back through the tunnel.
   * @param {string} requestId
   * @param {number} statusCode
   * @param {string} message
   */
  _sendErrorResponse(requestId, statusCode, message) {
    this._send({
      type: 'response',
      requestId,
      statusCode,
      headers: { 'content-type': 'text/plain' },
      body: Buffer.from(message).toString('base64'),
      truncated: false,
    });
  }

  /**
   * Start periodic heartbeat pings.
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this._send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the heartbeat timer.
   */
  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`❌ Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Exiting.`);
      process.exit(1);
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);

    if (!this.quiet) {
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() itself will handle re-scheduling on close
      }
    }, delay);
  }

  /**
   * Disconnect the tunnel intentionally.
   */
  disconnect() {
    this.intentionalClose = true;
    this._stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Get the assigned subdomain, if any.
   * @returns {string|null}
   */
  getAssignedSubdomain() {
    return this.assignedSubdomain;
  }
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function _formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
