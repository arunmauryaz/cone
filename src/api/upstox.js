/* ============================================================
   CONE — Upstox REST API Wrapper
   src/api/upstox.js
   ============================================================ */

import axios from 'axios';
import {
  getMockPrices,
  getMockHistoricalCandles,
  getMockInstruments,
  getMockDepth,
} from './mock.js';

const BASE_URL = 'https://api.upstox.com/v2';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/* ---- User Profile ---- */
export async function fetchUserProfile(accessToken) {
  const res = await axios.get(`${BASE_URL}/user/profile`, { headers: headers(accessToken) });
  return res.data?.data;
}

/* ---- Instruments ---- */
export async function fetchInstruments(accessToken) {
  // Upstox returns a giant CSV/JSON — we fall back to mock for now
  // Real implementation: GET /instruments and parse
  return getMockInstruments();
}

/* ---- LTP (multiple keys) ---- */
export async function fetchLTP(accessToken, instrumentKeys) {
  if (!accessToken) {
    // Return mock prices for given keys
    const mock = getMockPrices();
    const result = {};
    instrumentKeys.forEach(k => { if (mock[k]) result[k] = mock[k]; });
    return result;
  }
  try {
    const keysParam = instrumentKeys.join('%7C');
    const res = await axios.get(
      `${BASE_URL}/market-quote/ltp?instrument_key=${keysParam}`,
      { headers: headers(accessToken) }
    );
    return res.data?.data ?? {};
  } catch {
    return {};
  }
}

/* ---- OHLC ---- */
export async function fetchOHLC(accessToken, instrumentKey) {
  if (!accessToken) {
    const mock = getMockPrices();
    return mock[instrumentKey] ?? null;
  }
  try {
    const res = await axios.get(
      `${BASE_URL}/market-quote/ohlc?instrument_key=${instrumentKey}`,
      { headers: headers(accessToken) }
    );
    return res.data?.data?.[instrumentKey] ?? null;
  } catch {
    return null;
  }
}

/* ---- Historical Candles ---- */
export async function fetchHistoricalCandles(accessToken, instrumentKey, interval, toDate, fromDate) {
  if (!accessToken) {
    const countMap = { '1minute': 390, '5minute': 200, '30minute': 200, 'day': 300, 'week': 104, 'month': 60 };
    return getMockHistoricalCandles(instrumentKey, interval, countMap[interval] || 200);
  }
  try {
    const url = `${BASE_URL}/historical-candle/${encodeURIComponent(instrumentKey)}/${interval}/${toDate}/${fromDate}`;
    const res = await axios.get(url, { headers: headers(accessToken) });
    const raw = res.data?.data?.candles ?? [];
    // Upstox format: [timestamp, open, high, low, close, volume, oi]
    return raw.map(c => ({
      time:   Math.floor(new Date(c[0]).getTime() / 1000),
      open:   c[1],
      high:   c[2],
      low:    c[3],
      close:  c[4],
      volume: c[5],
    })).reverse();
  } catch {
    return getMockHistoricalCandles(instrumentKey, interval);
  }
}

/* ---- Market Depth ---- */
export async function fetchMarketDepth(accessToken, instrumentKey) {
  if (!accessToken) {
    return getMockDepth(instrumentKey);
  }
  try {
    const res = await axios.get(
      `${BASE_URL}/market-quote/depth?instrument_key=${instrumentKey}`,
      { headers: headers(accessToken) }
    );
    const data = res.data?.data?.[instrumentKey];
    if (!data) return getMockDepth(instrumentKey);
    const bids = (data.depth?.buy  ?? []).slice(0, 5).map(b => ({ price: b.price, qty: b.quantity, orders: b.orders }));
    const asks = (data.depth?.sell ?? []).slice(0, 5).map(a => ({ price: a.price, qty: a.quantity, orders: a.orders }));
    return { bids, asks };
  } catch {
    return getMockDepth(instrumentKey);
  }
}
