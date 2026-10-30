/* CONE — server-owned Live and Replay workspace data. */
import { createContext,useContext,useState,useEffect,useCallback,useMemo,useRef } from 'react';
import { marketSocket } from '../api/socket.js';
import { apiGet } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { isMarketOpen } from '../utils/calculations.js';
const MarketContext=createContext(null);
export function MarketProvider({children}){
  const {isLoggedIn}=useAuth();
  const [prices,setPrices]=useState(new Map()),[isConnected,setConnected]=useState(false),[isBackendLive,setBackend]=useState(false);
  const [marketStatus,setMarketStatus]=useState(isMarketOpen()?'OPEN':'CLOSED');
  const [instruments,setInstruments]=useState([]);
  const [source,setSource]=useState(()=>localStorage.getItem('cone_market_source')||'unknown');
  const [sessionId,setSessionId]=useState('');
  const [providerStatus,setProviderStatus]=useState('starting');
  const sourceRef=useRef(source),catalogueVersion=useRef('');
  useEffect(()=>{const timer=setInterval(()=>setMarketStatus(isMarketOpen()?'OPEN':'CLOSED'),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{let active=true;const load=()=>apiGet('/api/market/stocks').then(value=>{if(active)setInstruments(value);}).catch(()=>{});load();const timer=setInterval(load,300000);const changed=event=>{const provider=event.detail?.provider;if(provider){sourceRef.current=provider;setSource(provider);localStorage.setItem('cone_market_source',provider);setPrices(new Map());}load();};window.addEventListener('cone-provider-changed',changed);return()=>{active=false;clearInterval(timer);window.removeEventListener('cone-provider-changed',changed);};},[]);
  useEffect(()=>{
    if(!isLoggedIn)return;
    const offTicks=marketSocket.subscribe((values,metadata)=>{
      const sourceChanged=metadata?.source&&sourceRef.current!==metadata.source;
      if(metadata?.catalogueVersion&&catalogueVersion.current!==metadata.catalogueVersion){catalogueVersion.current=metadata.catalogueVersion;apiGet('/api/market/stocks').then(setInstruments).catch(()=>{});}
      if(metadata?.source){sourceRef.current=metadata.source;setSource(metadata.source);localStorage.setItem('cone_market_source',metadata.source);}
      setProviderStatus(metadata?.status||'connected');setSessionId(metadata?.sessionId||'');
      setPrices(new Map(Object.entries(values)));setConnected(true);
    });
    const offStatus=marketSocket.subscribeStatus(connected=>{setBackend(connected);if(!connected)setProviderStatus('disconnected');});
    marketSocket.connect();
    return()=>{offTicks();offStatus();marketSocket.disconnect();};
  },[isLoggedIn]);
  const [refreshing,setRefreshing]=useState(false);
  const refreshMarket=useCallback(async()=>{
    setRefreshing(true);
    try {
      marketSocket.disconnect();marketSocket.connect();setInstruments(await apiGet('/api/market/stocks'));
      window.dispatchEvent(new Event('cone-market-refresh'));
    }finally{setRefreshing(false);}
  },[]);
  const getPrice=useCallback(key=>prices.get(key)||null,[prices]);
  const searchInstruments=useCallback(query=>{if(!query)return[];const q=query.toLowerCase();return instruments.filter(i=>i.tradingsymbol.toLowerCase().includes(q)||i.name.toLowerCase().includes(q)).slice(0,20);},[instruments]);
  const movers=useMemo(()=>instruments.filter(i=>i.segment==='NSE_EQ'&&prices.has(i.instrumentKey)).map(i=>({...i,...prices.get(i.instrumentKey)})),[instruments,prices]);
  const getTopGainers=useCallback((n=5)=>[...movers].sort((a,b)=>(b.changePercent||0)-(a.changePercent||0)).slice(0,n),[movers]);
  const getTopLosers=useCallback((n=5)=>[...movers].sort((a,b)=>(a.changePercent||0)-(b.changePercent||0)).slice(0,n),[movers]);
  const getMostActive=useCallback((n=10)=>[...movers].sort((a,b)=>(b.volume||0)-(a.volume||0)).slice(0,n),[movers]);
  const value=useMemo(()=>({sessionId,refreshMarket,refreshing,prices,isConnected,isBackendLive,marketStatus,instruments,source,providerStatus,getPrice,searchInstruments,getTopGainers,getTopLosers,getMostActive}),[sessionId,refreshMarket,refreshing,prices,isConnected,isBackendLive,marketStatus,instruments,source,providerStatus,getPrice,searchInstruments,getTopGainers,getTopLosers,getMostActive]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
export function useMarket(){const value=useContext(MarketContext);if(!value)throw new Error('MarketProvider missing');return value;}
