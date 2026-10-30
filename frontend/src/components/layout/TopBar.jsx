import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, History, RefreshCw, Search, Bell, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useMarket } from '../../context/MarketContext.jsx';
export default function TopBar({ onSearchOpen, onMenu }) {
  const {user,logout}=useAuth(), {settings,saveSettings}=useSettings(), {unreadCount}=usePortfolio(), {source,refreshMarket,refreshing}=useMarket();
  const {pathname}=useLocation(), navigate=useNavigate();
  const [open,setOpen]=useState(false);const menu=useRef(null);
  useEffect(()=>{const close=e=>{if(!menu.current?.contains(e.target))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[]);
  const title=pathname.startsWith('/stock/') ? 'Stock' : ({'/dashboard':'Dashboard','/market':'Market','/orders':'Orders','/holdings':'Holdings','/positions':'Positions','/funds':'Funds','/analytics':'Analytics','/settings':'Settings','/notifications':'Notifications'}[pathname] || 'CONE');
  const day=settings.theme==='light';
  return <header className="app-topbar">
    <button className="btn-icon mobile-menu" aria-label="Open navigation" onClick={onMenu}><Menu size={19}/></button>
    <span className="topbar-title">{title}</span>
    <button className="shell-search" onClick={onSearchOpen} aria-label="Search stocks and pages"><Search size={15}/><span>Search stocks</span><kbd>Ctrl K</kbd></button>
    <div className="topbar-actions"><span className={`paper-label ${source==='replay'?'replay-badge':''}`}>{source==='replay'?<><History size={13}/>Replay</>:source==='upstox'?'Paper · Live':'Paper · Offline'}</span>
      {(pathname==='/market'||pathname.startsWith('/stock/')) && <button className="btn-icon" aria-label="Refresh market view" title="Refresh market view" disabled={refreshing} onClick={()=>refreshMarket().catch(()=>{})}><RefreshCw size={17}/></button>}
      <button className="btn-icon" aria-label={day ? 'Switch to Night mode' : 'Switch to Day mode'} onClick={()=>saveSettings({theme:day ? 'pitch-black' : 'light'})}>{day ? <Moon size={17}/> : <Sun size={17}/>}</button>
      <button className="btn-icon notification-button" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`} onClick={()=>navigate('/notifications')}><Bell size={17}/>{unreadCount>0 && <span className="notification-dot"/>}</button>
      <div ref={menu} className="account-menu"><button className="account-trigger" aria-label="Account menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>{user?.username || 'Account'}</span><ChevronDown size={13}/></button>{open && <div className="account-dropdown"><button onClick={()=>{setOpen(false);navigate('/settings');}}>Settings</button><button onClick={()=>{setOpen(false);logout();navigate('/login');}}>Sign out</button></div>}</div>
    </div>
  </header>;
}
