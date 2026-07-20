/* src/hooks/useOrderBook.js */
import { useState, useEffect } from 'react';
import { fetchMarketDepth } from '../api/upstox.js';
import { useSettings } from '../context/SettingsContext.jsx';

export function useOrderBook(instrumentKey) {
  const { settings } = useSettings();
  const [depth, setDepth] = useState(null);

  useEffect(() => {
    if (!instrumentKey) return;
    let cancelled = false;

    async function load() {
      const data = await fetchMarketDepth(settings.accessToken, instrumentKey);
      if (!cancelled) setDepth(data);
    }
    load();
    const id = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [instrumentKey, settings.accessToken]);

  return depth;
}
