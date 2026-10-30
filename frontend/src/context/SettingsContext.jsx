/* CONE â€” preferences. Provider configuration and secrets belong to the server. */
import { createContext,useContext,useState,useCallback,useMemo,useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSettings,saveSettings,getCurrentUser } from '../utils/storage.js';
import { apiGet,apiPut,apiError } from '../api/client.js';
import { readSession } from '../api/session.js';
import { normalizeTheme } from '../utils/theme.js';
const SettingsContext=createContext(null);
const clean=u=>{const value=getSettings(u);for(const key of ['apiKey','apiSecret','accessToken'])delete value[key];value.theme=normalizeTheme(value.theme);return value;};
export function SettingsProvider({children}){
  const [username,setUsername]=useState(getCurrentUser);
  const [settings,setSettings]=useState(()=>clean(getCurrentUser()));
  const [connectionStatus,setStatus]=useState('unchecked');
  useEffect(()=>{document.documentElement.setAttribute('data-theme',normalizeTheme(settings.theme));},[settings.theme]);
  const updateUsername=useCallback(u=>{
    setUsername(u);setSettings(clean(u));
    if(u&&readSession()?.token){apiGet('/api/settings').then(data=>setSettings({...clean(u),...data,theme:normalizeTheme(data.theme)})).catch(()=>{});}
  },[]);
  const save=useCallback(async updates=>{
    try{
      const allowed=['theme','refreshInterval','notifications','soundEnabled','confirmOrders','priceFlash','compactMode','showStockScreener','showMarketChart'];
      updates=Object.fromEntries(Object.entries(updates).filter(([key])=>allowed.includes(key)));
      if ('theme' in updates) updates.theme=normalizeTheme(updates.theme);
      if(readSession()?.token)await apiPut('/api/settings',updates);
      setSettings(previous=>{const next={...previous,...updates};if(username)saveSettings(username,next);return next;});
      return {ok:true};
    }catch(error){toast.error(apiError(error));return {ok:false,error:apiError(error)};}
  },[username]);
  const testConnection=useCallback(async()=>{
    try{const provider=await apiGet('/api/settings/provider');const ok=provider.status==='connected';setStatus(ok?'connected':'failed');return {ok,message:`${provider.provider}: ${provider.status}`};}
    catch(error){setStatus('failed');return {ok:false,message:apiError(error)};}
  },[]);
  const value=useMemo(()=>({settings,saveSettings:save,testConnection,connectionStatus,isApiConnected:settings.marketDataType==='upstox'&&connectionStatus==='connected',updateUsername}),[settings,save,testConnection,connectionStatus,updateUsername]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export function useSettings(){const value=useContext(SettingsContext);if(!value)throw new Error('SettingsProvider missing');return value;}
