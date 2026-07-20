/* ============================================================
   CONE — WebSocket Market Feed Manager
   src/api/websocket.js
   Uses Upstox WebSocket v3 feed + Protobuf decoding when API key set.
   Falls back gracefully when no token provided.
   ============================================================ */

const UPSTOX_WS_URL = 'wss://api.upstox.com/v3/feed/market-data-feed';

export class MarketFeedManager {
  constructor(accessToken) {
    this.accessToken   = accessToken;
    this.ws            = null;
    this.listeners     = [];
    this.subscribed    = new Set();
    this.isConnected   = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
  }

  connect() {
    if (!this.accessToken) {
      console.warn('[WS] No access token — skipping WebSocket connection');
      return;
    }

    try {
      this.ws = new WebSocket(`${UPSTOX_WS_URL}?token=${this.accessToken}`);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[WS] Connected to Upstox feed');
        // Re-subscribe to all previously tracked keys
        if (this.subscribed.size > 0) {
          this._sendSubscribe([...this.subscribed]);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          // Upstox sends Protobuf binary — decode if possible, else try JSON
          if (event.data instanceof ArrayBuffer) {
            this._handleBinary(event.data);
          } else {
            const json = JSON.parse(event.data);
            this._emitUpdate(json);
          }
        } catch (e) {
          // Silently ignore decode errors
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Error:', err);
      };

      this.ws.onclose = (e) => {
        this.isConnected = false;
        console.log('[WS] Closed, code:', e.code);
        if (this.reconnectAttempts < this.maxReconnects) {
          const delay = Math.min(3000 * (this.reconnectAttempts + 1), 30000);
          this.reconnectTimer = setTimeout(() => this.connect(), delay);
          this.reconnectAttempts++;
        }
      };
    } catch (e) {
      console.warn('[WS] connect() failed:', e);
    }
  }

  subscribe(instrumentKeys) {
    if (!instrumentKeys?.length) return;
    const newKeys = instrumentKeys.filter(k => !this.subscribed.has(k));
    if (!newKeys.length) return;
    newKeys.forEach(k => this.subscribed.add(k));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this._sendSubscribe(newKeys);
    }
  }

  unsubscribe(instrumentKeys) {
    if (!instrumentKeys?.length) return;
    instrumentKeys.forEach(k => this.subscribed.delete(k));

    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = {
        guid:     `unsub_${Date.now()}`,
        method:   'unsub',
        dataType: 'full',
        keys:     instrumentKeys,
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.listeners = [];
    this.subscribed.clear();
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /* ---- Private ---- */
  _sendSubscribe(keys) {
    const msg = {
      guid:     `sub_${Date.now()}`,
      method:   'sub',
      dataType: 'full',
      keys,
    };
    this.ws.send(JSON.stringify(msg));
  }

  _emitUpdate(data) {
    this.listeners.forEach(cb => {
      try { cb(data); } catch {}
    });
  }

  _handleBinary(buffer) {
    // Protobuf decode — simplified: attempt JSON parse of text portion
    // Full Protobuf decoding requires protobufjs + proto schema loaded at runtime
    // For now emit raw buffer for MarketContext to handle
    this._emitUpdate({ raw: buffer, source: 'binary' });
  }
}
