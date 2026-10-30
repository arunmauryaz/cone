/* socket.js - Real-time WebSocket Market Stream */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/market';

class MarketWebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectTimer = null;
    this.isConnected = false;
    this.shouldReconnect = true;
  }

  connect() {
    this.shouldReconnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'TICK' || data.type === 'SNAPSHOT') {
            this.notifyListeners(data.prices, data);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        this.notifyStatus(false);
      };
    } catch (err) {
      this.isConnected = false;
      this.notifyStatus(false);
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2500);
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  subscribeStatus(callback) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  notifyListeners(prices, metadata) {
    for (const listener of this.listeners) {
      try {
        listener(prices, metadata);
      } catch (err) {
        console.error('[WS] Listener error:', err);
      }
    }
  }

  notifyStatus(status) {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[WS] Status listener error:', err);
      }
    }
  }
}

export const marketSocket = new MarketWebSocketClient();
