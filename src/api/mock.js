/* ============================================================
   CONE — Mock Market Data Feed
   src/api/mock.js
   ============================================================ */

import { MOCK_STOCKS } from '../utils/constants.js';

/* Internal price state */
const prices = {};

function initPrices() {
  MOCK_STOCKS.forEach(s => {
    prices[s.instrumentKey] = {
      ltp:           s.basePrice,
      open:          s.basePrice * (0.995 + Math.random() * 0.01),
      high:          s.basePrice * (1 + Math.random() * 0.015),
      low:           s.basePrice * (0.985 + Math.random() * 0.005),
      close:         s.basePrice * (0.993 + Math.random() * 0.008),
      volume:        Math.floor(Math.random() * 500000),
      change:        0,
      changePercent: 0,
    };
  });
}

initPrices();

/* Tick prices every call (called by setInterval) */
function tickPrices() {
  MOCK_STOCKS.forEach(s => {
    const prev = prices[s.instrumentKey];
    // Random walk: -0.3% to +0.3% per tick
    const pct    = (Math.random() * 0.006) - 0.003;
    const newLtp = Math.max(prev.ltp * (1 + pct), 0.05);
    const rounded = Math.round(newLtp / s.tickSize) * s.tickSize;

    prices[s.instrumentKey] = {
      ltp:           +rounded.toFixed(2),
      open:          prev.open,
      high:          Math.max(prev.high, rounded),
      low:           Math.min(prev.low,  rounded),
      close:         prev.close,
      volume:        prev.volume + Math.floor(Math.random() * 500),
      change:        +(rounded - prev.close).toFixed(2),
      changePercent: +(((rounded - prev.close) / prev.close) * 100).toFixed(2),
    };
  });
}

/**
 * Start the mock feed. Returns a cleanup function.
 * @param {(prices: Object) => void} onUpdate
 * @param {number} intervalMs
 */
export function startMockFeed(onUpdate, intervalMs = 1000) {
  // Immediately call once
  onUpdate({ ...prices });
  const id = setInterval(() => {
    tickPrices();
    onUpdate({ ...prices });
  }, intervalMs);
  return () => clearInterval(id);
}

/**
 * Get current mock prices snapshot
 */
export function getMockPrices() {
  return { ...prices };
}

/**
 * Get mock instruments list
 */
export function getMockInstruments() {
  return MOCK_STOCKS;
}

/**
 * Generate synthetic historical OHLCV candles
 * @param {string} instrumentKey
 * @param {string} interval - '1minute', '30minute', 'day', 'week', 'month'
 * @param {number} count - number of candles to return
 */
export function getMockHistoricalCandles(instrumentKey, interval, count = 300) {
  const stock = MOCK_STOCKS.find(s => s.instrumentKey === instrumentKey);
  const base  = stock?.basePrice ?? 1000;
  const seed  = instrumentKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  // ms per candle
  const msMap = {
    '1minute':  60 * 1000,
    '3minute':  3 * 60 * 1000,
    '5minute':  5 * 60 * 1000,
    '15minute': 15 * 60 * 1000,
    '30minute': 30 * 60 * 1000,
    '1hour':    60 * 60 * 1000,
    'day':      24 * 60 * 60 * 1000,
    'week':     7  * 24 * 60 * 60 * 1000,
    'month':    30 * 24 * 60 * 60 * 1000,
  };
  const ms = msMap[interval] || msMap['day'];

  const candles = [];
  let price = base;
  let ts    = Date.now() - count * ms;

  // Seeded pseudo-random for consistency per session
  let s = seed;
  function rand() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  }

  for (let i = 0; i < count; i++) {
    const change = price * (rand() * 0.024 - 0.012); // ±1.2%
    const open   = price;
    const close  = +(price + change).toFixed(2);
    const high   = +(Math.max(open, close) * (1 + rand() * 0.006)).toFixed(2);
    const low    = +(Math.min(open, close) * (1 - rand() * 0.006)).toFixed(2);
    const volume = Math.floor(rand() * 1000000 + 10000);

    candles.push({
      time:   Math.floor(ts / 1000), // Unix seconds for lightweight-charts
      open:   +open.toFixed(2),
      high,
      low,
      close,
      volume,
    });

    price = close;
    ts   += ms;
  }

  return candles;
}

/**
 * Generate mock market depth (bid/ask 5 levels)
 */
export function getMockDepth(instrumentKey) {
  const ltp = prices[instrumentKey]?.ltp ?? 1000;
  const bids = [], asks = [];
  for (let i = 0; i < 5; i++) {
    bids.push({
      price:  +(ltp - (i + 1) * 0.05).toFixed(2),
      qty:    Math.floor(Math.random() * 5000 + 100),
      orders: Math.floor(Math.random() * 10 + 1),
    });
    asks.push({
      price:  +(ltp + (i + 1) * 0.05).toFixed(2),
      qty:    Math.floor(Math.random() * 5000 + 100),
      orders: Math.floor(Math.random() * 10 + 1),
    });
  }
  return { bids, asks };
}
