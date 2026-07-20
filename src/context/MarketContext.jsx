/* ============================================================
   CONE — Market Context
   src/context/MarketContext.jsx
   Manages live prices via mock feed or Upstox WebSocket.
   ============================================================ */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef
} from 'react';
import { startMockFeed, getMockInstruments } from '../api/mock.js';
import { useSettings } from './SettingsContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { isMarketOpen } from '../utils/calculations.js';
import { MOCK_STOCKS, INDEX_STOCKS } from '../utils/constants.js';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const { settings, isApiConnected } = useSettings();
  const { isLoggedIn } = useAuth();

  const [prices, setPrices]         = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState(isMarketOpen() ? 'OPEN' : 'CLOSED');
  const [instruments] = useState(MOCK_STOCKS);
  const stopFeedRef   = useRef(null);

  // Update market status every minute
  useEffect(() => {
    const id = setInterval(() => {
      setMarketStatus(isMarketOpen() ? 'OPEN' : 'CLOSED');
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Start the price feed when logged in
  useEffect(() => {
    if (!isLoggedIn) return;

    // Clean up any existing feed
    if (stopFeedRef.current) {
      stopFeedRef.current();
      stopFeedRef.current = null;
    }

    // For now always use mock feed
    // (Real Upstox WebSocket is wired in websocket.js but requires valid token)
    const stop = startMockFeed((newPrices) => {
      setPrices(prev => {
        const next = new Map(prev);
        Object.entries(newPrices).forEach(([key, val]) => next.set(key, val));
        return next;
      });
      setIsConnected(true);
    }, 1000);

    stopFeedRef.current = stop;
    return () => {
      stop();
      stopFeedRef.current = null;
    };
  }, [isLoggedIn]);

  const getPrice = useCallback((instrumentKey) => {
    return prices.get(instrumentKey) ?? null;
  }, [prices]);

  const searchInstruments = useCallback((query) => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return instruments
      .filter(i =>
        i.tradingsymbol.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [instruments]);

  const getTopGainers = useCallback((n = 5) => {
    return instruments
      .filter(i => i.segment === 'NSE_EQ' && prices.has(i.instrumentKey))
      .map(i => ({ ...i, ...prices.get(i.instrumentKey) }))
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
      .slice(0, n);
  }, [instruments, prices]);

  const getTopLosers = useCallback((n = 5) => {
    return instruments
      .filter(i => i.segment === 'NSE_EQ' && prices.has(i.instrumentKey))
      .map(i => ({ ...i, ...prices.get(i.instrumentKey) }))
      .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
      .slice(0, n);
  }, [instruments, prices]);

  const getMostActive = useCallback((n = 10) => {
    return instruments
      .filter(i => i.segment === 'NSE_EQ' && prices.has(i.instrumentKey))
      .map(i => ({ ...i, ...prices.get(i.instrumentKey) }))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, n);
  }, [instruments, prices]);

  const value = useMemo(() => ({
    prices,
    isConnected,
    marketStatus,
    instruments,
    getPrice,
    searchInstruments,
    getTopGainers,
    getTopLosers,
    getMostActive,
  }), [prices, isConnected, marketStatus, instruments, getPrice, searchInstruments, getTopGainers, getTopLosers, getMostActive]);

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error('useMarket must be used inside MarketProvider');
  return ctx;
}
