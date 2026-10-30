/* CONE — Portfolio Context. Accounts and replay workspaces are server-owned. */
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import api, { apiGet, apiError } from '../api/client.js';
import { useMarket } from './MarketContext.jsx';
import { useAuth } from './AuthContext.jsx';
const PortfolioContext = createContext(null);
const empty = () => ({ wallet:{balance:0,usedMargin:0,openingBalance:100000,todayPayin:0,todayPayout:0,transactions:[]}, holdings:[],positions:[],orders:[],gttOrders:[],sips:[],alerts:[],watchlists:[],notifications:[],achievements:[],history:[],totalPortfolioValue:0 });
export function PortfolioProvider({ children }) {
  const { user } = useAuth();
  const {source,sessionId}=useMarket();
  return <ServerProvider key={`${user?.id||'signed-out'}:${source==='replay'?`replay:${sessionId}`:'normal'}`}>{children}</ServerProvider>;
}
function ServerProvider({children}) {
  const { user }=useAuth();
  const userId=user?.id;
  const [state,setState]=useState(empty);
  const [connectionError,setConnectionError]=useState('');
  const [orderModal,setOrderModal]=useState({visible:false,instrumentKey:null,side:'BUY'});
  const current=useRef(state), epoch=useRef(0), busy=useRef(0), queue=useRef(Promise.resolve()), alive=useRef(true);
  const orderRequests=useRef(new Map());
  const refresh=useCallback(async version => {
    const snapshot=await apiGet('/api/portfolio/state');
    if (alive.current && (version == null || version === epoch.current)) { current.current=snapshot;setState(snapshot);setConnectionError(''); }
    return snapshot;
  }, []);
  useEffect(() => {
    alive.current=true;
    if (!userId) return () => { alive.current=false; };
    const poll=async () => { if (busy.current) return; const version=epoch.current; try { await refresh(version); } catch(error) { if(alive.current) setConnectionError(apiError(error)); } };
    poll(); const timer=setInterval(poll,1500);
    return () => { alive.current=false;clearInterval(timer); };
  }, [userId,refresh]);
  const action=useCallback((method,path,data={},message) => {
    const operation=queue.current.then(async () => {
      busy.current++; epoch.current++;
      try {
        const spec=typeof path === 'function' ? path(current.current) : {path,data};
        const response=await api.request({method,url:spec.path,data:spec.data});
        try { await refresh(); } catch { if(alive.current)setConnectionError('Saved on the server; waiting to refresh account state.'); }
        if(message) toast.success(message);
        return {ok:true,...response.data};
      } catch(error) { const message=apiError(error);toast.error(message);if(alive.current)setConnectionError(error.response ? '' : message);return {ok:false,error:message,transportUncertain:!error.response}; }
      finally { busy.current--; }
    });
    queue.current=operation.then(() => undefined, () => undefined);return operation;
  }, [refresh]);
  const actions=useMemo(() => {
    const watchlist=(index,change) => snapshot => {
      const list=snapshot.watchlists[index];if(!list)throw new Error('Watchlist no longer exists');
      return {path:`/api/portfolio/watchlists/${list.id}`,data:{stocks:change(list.stocks)}};
    };
    return {
      placeOrder:async params => {
        const request={...params};
        if(request.orderType==='MARKET')delete request.price;
        const fingerprint=JSON.stringify(request);
        const id=params.id || orderRequests.current.get(fingerprint) || crypto.randomUUID();
        orderRequests.current.set(fingerprint,id);
        const result=await action('POST','/api/orders',{...request,id},'Order submitted');
        if(result.ok || !result.transportUncertain)orderRequests.current.delete(fingerprint);
        return result;
      },
      cancelOrder:id => action('DELETE',`/api/orders/${encodeURIComponent(id)}`,{},'Order cancelled'),
      modifyOrder:(id,updates) => action('PUT',`/api/orders/${encodeURIComponent(id)}`,updates,'Order modified'),
      exitPosition:id => action('POST',`/api/portfolio/positions/${encodeURIComponent(id)}/exit`,{},'Position exited'),
      exitAllPositions:() => action('POST','/api/portfolio/positions/exit-all',{},'Positions exited'),
      addCoins:amount => action('POST','/api/portfolio/funds/add',{amount},'CONE Coins added'),
      resetPortfolio:() => action('POST','/api/portfolio/reset',{},'Portfolio reset'),
      addToWatchlist:(index,key) => action('PUT',watchlist(index,stocks => [...new Set([...stocks,key])])),
      removeFromWatchlist:(index,key) => action('PUT',watchlist(index,stocks => stocks.filter(k => k !== key))),
      toggleWatchlist:(index=0,key) => action('PUT',watchlist(index,stocks => stocks.includes(key) ? stocks.filter(k=>k!==key) : [...stocks,key])),
      createWatchlist:name => action('POST','/api/portfolio/watchlists',{name}),
      moveWatchlistItem:(sourceId,params) => action('PUT',`/api/portfolio/watchlists/${encodeURIComponent(sourceId)}/move`,params),
      updateWatchlist:(index,change) => action('PUT',snapshot => { const list=snapshot.watchlists[index];if(!list)throw new Error('Watchlist no longer exists');return {path:`/api/portfolio/watchlists/${list.id}`,data:typeof change==='function'?change(list):change}; }),
      deleteWatchlist:index => action('DELETE',snapshot => { const list=snapshot.watchlists[index];if(!list)throw new Error('Watchlist no longer exists');return {path:`/api/portfolio/watchlists/${list.id}`}; }),
      addAlert:params => action('POST','/api/orders/alerts',params,'Alert created'),
      removeAlert:id => action('DELETE',`/api/orders/alerts/${id}`),
      addGTT:params => action('POST','/api/orders/gtt',params,'GTT created'),
      removeGTT:id => action('DELETE',`/api/orders/gtt/${id}`),
      addSIP:params => action('POST','/api/orders/sips',params,'SIP created'),
      removeSIP:id => action('DELETE',`/api/orders/sips/${id}`),
      pauseSIP:id => action('PATCH',`/api/orders/sips/${id}/status`,{active:false}),
      resumeSIP:id => action('PATCH',`/api/orders/sips/${id}/status`,{active:true}),
      markRead:id => action('POST',`/api/notifications/${id}/read`),
      markAllRead:() => action('POST','/api/notifications/read-all'),
      clearNotifications:() => action('DELETE','/api/notifications'),
    };
  }, [action]);
  const value=useMemo(() => ({...state,...actions,connectionError,unreadCount:state.notifications.filter(n=>!n.read).length,orderModal,openOrderModal:params=>setOrderModal({visible:true,...params}),closeOrderModal:()=>setOrderModal(m=>({...m,visible:false}))}), [state,actions,connectionError,orderModal]);
  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}
export function usePortfolio() { const context=useContext(PortfolioContext);if(!context)throw new Error('PortfolioProvider missing');return context; }
