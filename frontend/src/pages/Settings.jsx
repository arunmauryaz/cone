/* Settings.jsx */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, Sun, Moon, AlertTriangle, Download, Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { apiGet } from '../api/client.js';
import { clearAllData } from '../utils/storage.js';
import { APP_VERSION } from '../utils/constants.js';
import toast from 'react-hot-toast';
import { useMarket } from '../context/MarketContext.jsx';
import ReplayWorkspaces from '../components/trading/ReplayWorkspaces.jsx';
import ProviderSettings from '../components/trading/ProviderSettings.jsx';

const CATEGORIES = ['Market Data', 'Replay workspaces', 'Account', 'Appearance', 'Customization', 'Notifications', 'Portfolio Reset', 'Data & Privacy', 'About'];

export default function Settings() {

  const {source}=useMarket();
  const { settings, saveSettings } = useSettings();
  const { user, updateProfile, logout } = useAuth();
  const { resetPortfolio } = usePortfolio();
  const navigate = useNavigate();

  const [settingsSearch,setSettingsSearch]=useState('');
  const location=useLocation();
  useEffect(()=>{if(new URLSearchParams(location.search).get('section')==='replays')setCat('Replay workspaces');},[location.search]);
  const [cat, setCat]         = useState('Market Data');
  const [resetInput, setResetInput] = useState('');
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', username:user?.username || '', currentPassword:'', password: '', confirmPw: '' });
  const [savingProfile,setSavingProfile]=useState(false);

  async function handleSaveProfile() {
    if(savingProfile)return;
    if(profile.password && profile.password.length<8)return toast.error('New password must be at least 8 characters');
    if(profile.password!==profile.confirmPw)return toast.error('New passwords do not match');
    setSavingProfile(true);
    const result=await updateProfile({fullName:profile.fullName,username:profile.username,currentPassword:profile.currentPassword,newPassword:profile.password});
    setSavingProfile(false);
    if(result.ok){setProfile(p=>({...p,username:p.username.trim().toLowerCase(),currentPassword:'',password:'',confirmPw:''}));toast.success('Account updated');}
    else toast.error(result.error);
  }

  async function handleExport() {
    const data = await apiGet('/api/portfolio/state');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cone_portfolio_${user?.username}.json`;
    a.click();
    toast.success('Portfolio exported');
  }

  function handleClearAll() {
    if (!window.confirm('Clear browser cache and sign out? Your server account and trading records will remain.')) return;
    clearAllData();
    logout();
    navigate('/login');
  }

  return (
    <div className="settings-shell">
      <nav className="settings-nav" aria-label="Settings categories">
        <input className="input" aria-label="Search settings" placeholder="Search settings" value={settingsSearch} onChange={e=>{const q=e.target.value;setSettingsSearch(q);if(/replay|workspace|result/i.test(q))setCat('Replay workspaces');else if(/live|upstox|api|token/i.test(q))setCat('Market Data');else if(/screen|chart|panel|custom/i.test(q))setCat('Customization');}}/>
        {CATEGORIES.filter(c=>source!=='replay'||c!=='Portfolio Reset').filter(c=>!settingsSearch||c.toLowerCase().includes(settingsSearch.toLowerCase())||(/screen|chart|panel/i.test(settingsSearch)&&c==='Customization')||(/live|upstox|api|token/i.test(settingsSearch)&&c==='Market Data')||(/replay|workspace|result/i.test(settingsSearch)&&c==='Replay workspaces')).map(c => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </nav>

      {/* Content */}
      <div style={{ flex: 1 }}>
        {cat==='Replay workspaces'&&<ReplayWorkspaces/>}
        {cat === 'Market Data' && <div className="glass-card" style={{padding:24}}><ProviderSettings/></div>}

        {/* Account */}
        {cat === 'Account' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)' }}>Account</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', padding:'var(--space-md)', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-md)' }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--gradient-primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:800, color:'#fff' }}>
                  {user?.fullName?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:700 }}>{user?.fullName}</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>@{user?.username}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Member since {new Date(user?.createdAt).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Display Name</label>
                <input className="input" value={profile.fullName} onChange={e => setProfile(p => ({...p,fullName:e.target.value}))} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="account-username">Username</label>
                <input id="account-username" className="input" autoComplete="username" value={profile.username} onChange={e=>setProfile(p=>({...p,username:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="account-current-password">Current Password</label>
                <input id="account-current-password" className="input" type="password" autoComplete="current-password" value={profile.currentPassword} onChange={e=>setProfile(p=>({...p,currentPassword:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="account-new-password">New Password (optional)</label>
                <input id="account-new-password" className="input" type="password" autoComplete="new-password" value={profile.password} onChange={e=>setProfile(p=>({...p,password:e.target.value}))}/>
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="account-confirm-password">Confirm New Password</label>
                <input id="account-confirm-password" className="input" type="password" autoComplete="new-password" value={profile.confirmPw} onChange={e=>setProfile(p=>({...p,confirmPw:e.target.value}))}/>
              </div>
              <button className="btn btn-primary" disabled={savingProfile} style={{ width:'fit-content' }} onClick={handleSaveProfile}>
                {savingProfile ? 'Savingâ€¦' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {cat === 'Appearance' && (
          <section className="glass-card" style={{padding:24}}>
            <h2 className="settings-heading">Appearance</h2>

            <div className="theme-options" aria-label="Theme">
              {[['pitch-black','Night',Moon],['charcoal-dark','Charcoal',Moon],['light','Day',Sun]].map(([theme,label,Icon]) => <button key={theme} className="theme-option" aria-label={`${label} theme`} aria-pressed={settings.theme === theme} onClick={() => saveSettings({theme})}><Icon size={18}/><span>{label}</span>{settings.theme === theme && <Check size={15} className="theme-selection"/>}</button>)}
            </div>
          </section>
        )}

        {cat==='Customization' && <section className="glass-card" style={{padding:24}}><h2 className="settings-heading">Market panels</h2>            <div className="market-panel-preferences">{[['showStockScreener','Stock screener'],['showMarketChart','Chart panel']].map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={settings[key]!==false} onChange={e=>saveSettings({[key]:e.target.checked})}/></label>)}</div><p className="muted">Hidden screeners do not request table quotes. Watchlist prices stay live.</p></section>}
        {/* Notifications */}
        {cat === 'Notifications' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)' }}>Notifications</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              {[
                { key:'orderExecution', label:'Order Execution', desc:'When your orders are filled' },
                { key:'priceAlerts',    label:'Price Alerts',    desc:'When price alerts trigger' },
                { key:'misSqOff',       label:'MIS Squareoff',   desc:'Warning at 3:15 PM for MIS positions' },
                { key:'dailySummary',   label:'Daily Summary',   desc:'End of day portfolio summary' },
              ].map(n => (
                <div key={n.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--space-md)', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{n.label}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{n.desc}</div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={settings.notifications?.[n.key] !== false}
                      onChange={e => saveSettings({ notifications: { ...(settings.notifications||{}), [n.key]: e.target.checked }})}/>
                    <span className="toggle-slider"/>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Reset */}
        {cat === 'Portfolio Reset' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)', display:'flex', alignItems:'center', gap:8 }}>
              <AlertTriangle size={20} style={{ color:'var(--color-sell)' }}/> Portfolio Reset
            </h2>
            <div className="alert alert-danger" style={{ marginBottom:'var(--space-lg)' }}>
              This will clear ALL your trades, holdings, positions, and reset your balance to C 1,00,000. This cannot be undone.
            </div>
            <div className="input-group" style={{ marginBottom:'var(--space-md)' }}>
              <label className="input-label">Type "RESET" to confirm</label>
              <input className="input" value={resetInput} onChange={e => setResetInput(e.target.value)} placeholder="Type RESET here"/>
            </div>
            <button className="btn btn-sell" disabled={resetInput !== 'RESET'} onClick={() => { resetPortfolio(); setResetInput(''); }}>
              Reset Portfolio
            </button>
          </div>
        )}

        {/* Data & Privacy */}
        {cat === 'Data & Privacy' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)' }}>Data & Privacy</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div style={{ padding:'var(--space-md)', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-md)' }}>
                <div style={{ fontWeight:600, marginBottom:4 }}>Export Portfolio Data</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:'var(--space-sm)' }}>Download your portfolio, orders, and holdings as JSON</div>
                <button className="btn btn-ghost btn-sm" onClick={handleExport}><Download size={14}/> Export JSON</button>
              </div>
              <div style={{ padding:'var(--space-md)', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--radius-md)' }}>
                <div style={{ fontWeight:600, marginBottom:4, color:'var(--color-sell)' }}>Clear Browser Cache</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:'var(--space-sm)' }}>Clear local browser preferences and sign out. Server trading records remain.</div>
                <button className="btn btn-sell btn-sm" onClick={handleClearAll}><Trash2 size={14}/> Clear browser data</button>
              </div>
            </div>
          </div>
        )}

        {cat === 'About' && (
          <section className="glass-card" style={{padding:24}}>
            <h2 className="settings-heading">CONE</h2>
            <p style={{color:'var(--text-secondary)',marginBottom:12}}>Paper trading Â· v{APP_VERSION}</p>
            <p style={{fontSize:12,color:'var(--text-secondary)'}}>Virtual CONE Coins. No real broker orders.</p>
          </section>
        )}
      </div>
    </div>
  );
}
