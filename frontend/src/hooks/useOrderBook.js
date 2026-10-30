/* CONE — depth from the same backend provider that prices trading executions. */
import { useState, useEffect } from 'react';
import { apiGet } from '../api/client.js';
import { useMarket } from '../context/MarketContext.jsx';
export function useOrderBook(instrumentKey) {
  const {source,prices}=useMarket();
  const hasQuote=prices.has(instrumentKey);
  const [depth,setDepth]=useState(null);
  useEffect(() => {
    if(!instrumentKey||source==='replay'||(source==='upstox'&&!hasQuote)){setDepth(null);return;}
    let active=true;setDepth(null);
    const load=async()=>{try{const value=await apiGet(`/api/market/depth/${encodeURIComponent(instrumentKey)}`);if(active)setDepth(value);}catch{if(active)setDepth(null);}};
    load();window.addEventListener('cone-market-refresh',load);const timer=setInterval(load,3000);return()=>{active=false;clearInterval(timer);window.removeEventListener('cone-market-refresh',load);};
  },[instrumentKey,source,hasQuote]);
  return depth;
}
