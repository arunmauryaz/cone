import { useEffect, useRef } from 'react';
import { apiPut } from '../api/client.js';
export function useMarketInterest(keys) {
  const client=useRef(crypto.randomUUID());
  const signature=[...new Set(keys.filter(Boolean))].sort().slice(0,100).join(',');
  useEffect(()=>{
    const id=client.current;
    const send=()=>apiPut('/api/market/interest',{clientId:id,instrumentKeys:signature?signature.split(','):[]}).catch(()=>{});
    send();const timer=setInterval(send,15000);
    return()=>{clearInterval(timer);apiPut('/api/market/interest',{clientId:id,instrumentKeys:[]}).catch(()=>{});};
  },[signature]);
}
