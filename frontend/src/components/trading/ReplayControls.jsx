import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiGet, apiPut, apiError } from '../../api/client.js';
import { useMarket } from '../../context/MarketContext.jsx';
export default function ReplayControls(){
 const {source}=useMarket();const [info,setInfo]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(source!=='replay')return;let active=true;const load=()=>apiGet('/api/replay').then(v=>{if(active)setInfo(v)}).catch(()=>{});load();const timer=setInterval(load,1000);return()=>{active=false;clearInterval(timer)};},[source]);
 if(source!=='replay')return null;
 const control=async updates=>{setBusy(true);setError('');try{setInfo(await apiPut('/api/replay',updates));window.dispatchEvent(new Event('cone-market-refresh'));}catch(e){setError(apiError(e))}finally{setBusy(false)}};
 return <div className="replay-controls"><span>Replay · {info?.name||'No workspace selected'}</span><button className="btn btn-ghost btn-sm" disabled={busy||!info?.loaded||info.finished} onClick={()=>control({action:info?.playing?'pause':'play'})}>{info?.playing?'Pause':'Play'}</button><button className="btn btn-ghost btn-sm" disabled={busy||!info?.loaded||info.finished} onClick={()=>control({action:'step'})}>Step 1 min</button><select aria-label="Replay speed" value={info?.speed||60} disabled={busy} onChange={e=>control({speed:Number(e.target.value),action:info?.playing?'play':'pause'})}>{[1,10,60].map(n=><option key={n} value={n}>{n}×</option>)}</select><button className="btn btn-ghost btn-sm" disabled={busy||!info?.loaded||info.finished} onClick={()=>control({action:'end'})}>End replay</button><Link to="/settings?section=replays">Workspaces & results</Link><span className="muted">{info?.cursor||0}/{info?.total||0} min{info?.finished?' · Finished':''}</span>{error&&<span role="alert">{error}</span>}</div>
}
