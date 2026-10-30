import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import OrderModal from '../trading/OrderModal.jsx';
import CommandPalette from '../common/CommandPalette.jsx';
import { getSidebarCollapsed, setSidebarCollapsed } from '../../utils/storage.js';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useMarket } from '../../context/MarketContext.jsx';
import './Layout.css';
export default function Layout() {
  const {connectionError,orderModal}=usePortfolio();
  const {isBackendLive,providerStatus,source}=useMarket();
  const [collapsed,setCollapsedState]=useState(getSidebarCollapsed);
  const [paletteOpen,setPaletteOpen]=useState(false),[mobileOpen,setMobileOpen]=useState(false);
  const setCollapsed=value=>setCollapsedState(previous=>{const next=typeof value==='function' ? value(previous) : value;setSidebarCollapsed(next);return next;});
  useEffect(()=>{const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'&&!orderModal?.visible){e.preventDefault();setPaletteOpen(true);}if(e.key==='Escape'){setPaletteOpen(false);setMobileOpen(false);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[orderModal?.visible]);
  const marketWarning=!isBackendLive?'Cannot reach the market data service. Prices may be stale.':providerStatus==='authentication-failed'?'Upstox rejected the saved token. Check Settings → Market Data. Live prices are unavailable.':providerStatus==='not-configured'?'Add an Upstox token in Settings → Market Data to receive live prices.':['starting','connecting'].includes(providerStatus)?'Connecting to market data…':providerStatus!=='connected'?`${source==='upstox'?'Upstox':'Market'} connection interrupted. Prices may be stale.`:'';
  const warning=connectionError ? `Account connection lost. ${connectionError}` : marketWarning;
  return <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} onClose={()=>setMobileOpen(false)}/>
    <TopBar onSearchOpen={()=>setPaletteOpen(true)} onMenu={()=>setMobileOpen(v=>!v)}/>
    <main className="app-main">{warning && <div role="status" className="connection-warning">{warning}</div>}<Outlet/></main>
    <OrderModal/>{paletteOpen && <CommandPalette onClose={()=>setPaletteOpen(false)}/>}
    <Toaster position="bottom-right" toastOptions={{style:{background:'var(--bg-surface)',color:'var(--text-primary)',border:'1px solid var(--border-subtle)',fontSize:12,borderRadius:4,boxShadow:'none'}}}/>
  </div>;
}
