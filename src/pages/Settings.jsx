/* Settings.jsx */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, AlertTriangle, Download, Upload, Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { getPortfolio, clearAllData } from '../utils/storage.js';
import { APP_VERSION } from '../utils/constants.js';
import toast from 'react-hot-toast';

const CATEGORIES = ['API Configuration','Account','Appearance','Notifications','Portfolio Reset','Data & Privacy','About'];

export default function Settings() {
  const { settings, saveSettings, testConnection, connectionStatus } = useSettings();
  const { user, updateProfile, logout } = useAuth();
  const { resetPortfolio } = usePortfolio();
  const navigate = useNavigate();

  const [cat, setCat]       = useState('API Configuration');
  const [testing, setTesting] = useState(false);
  const [connResult, setConnResult] = useState(null);
  const [resetInput, setResetInput] = useState('');
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', password: '', confirmPw: '' });

  async function handleTestConnection() {
    setTesting(true);
    const result = await testConnection();
    setConnResult(result);
    setTesting(false);
  }

  function handleExport() {
    const data = getPortfolio(user?.username);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cone_portfolio_${user?.username}.json`;
    a.click();
    toast.success('Portfolio exported');
  }

  function handleClearAll() {
    if (!window.confirm('This will delete ALL data. Are you sure?')) return;
    clearAllData();
    logout();
    navigate('/login');
  }

  const catIcon = {
    'API Configuration': '🔑',
    'Account':            '👤',
    'Appearance':         '🎨',
    'Notifications':      '🔔',
    'Portfolio Reset':    '⚠️',
    'Data & Privacy':     '🔒',
    'About':              'ℹ️',
  };

  return (
    <div style={{ display:'flex', gap:'var(--space-md)', minHeight:'70vh' }}>
      {/* Left nav */}
      <div className="glass-card" style={{ width:220, flexShrink:0, padding:'var(--space-sm)', alignSelf:'flex-start' }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px',
            background: cat===c ? 'rgba(139,92,246,0.12)' : 'none',
            borderLeft: cat===c ? '2px solid var(--accent-primary)' : '2px solid transparent',
            border:'none', borderRadius:'var(--radius-sm)', color: cat===c ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontSize:13, cursor:'pointer', fontWeight: cat===c ? 600 : 400, textAlign:'left',
          }}>
            <span>{catIcon[c]}</span>{c}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1 }}>
        {/* API Configuration */}
        {cat === 'API Configuration' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)' }}>API Configuration</h2>
            <div className="alert alert-info" style={{ marginBottom:'var(--space-md)' }}>
              Connect your Upstox account for real market data. Without an API key, CONE uses simulated prices.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              {[
                { key:'apiKey',      label:'API Key',      type:'text',     ph:'Your Upstox API Key' },
                { key:'apiSecret',   label:'API Secret',   type:'password', ph:'Your Upstox API Secret' },
                { key:'accessToken', label:'Access Token', type:'password', ph:'OAuth2 Access Token' },
              ].map(f => (
                <div key={f.key} className="input-group">
                  <label className="input-label">{f.label}</label>
                  <input className="input" type={f.type} placeholder={f.ph}
                    value={settings[f.key] || ''}
                    onChange={e => saveSettings({ [f.key]: e.target.value })} />
                </div>
              ))}
              <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                <button className="btn btn-primary" onClick={handleTestConnection} disabled={testing}>
                  {testing ? '⏳ Testing...' : '🔌 Test Connection'}
                </button>
                {connResult && (
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color: connResult.ok ? 'var(--color-buy)' : 'var(--color-sell)' }}>
                    {connResult.ok ? <Check size={14}/> : <X size={14}/>}
                    {connResult.ok ? 'Connected!' : connResult.message}
                  </div>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                API data is stored only in your browser. Never shared.
              </div>
            </div>
          </div>
        )}

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
              <button className="btn btn-primary" style={{ width:'fit-content' }} onClick={() => { updateProfile({ fullName: profile.fullName }); toast.success('Profile updated!'); }}>
                Save Profile
              </button>
            </div>
          </div>
        )}

        {/* Appearance */}
        {cat === 'Appearance' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", marginBottom:'var(--space-md)' }}>Appearance</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--space-md)', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Dark Mode</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Toggle between dark and light theme</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.theme === 'dark'} onChange={e => {
                    const t = e.target.checked ? 'dark' : 'light';
                    saveSettings({ theme: t });
                    document.documentElement[t==='light' ? 'setAttribute' : 'removeAttribute']('data-theme', 'light');
                  }}/>
                  <span className="toggle-slider"/>
                </label>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'var(--space-md)', background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-md)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>Price Flash Animations</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>Green/red flash when prices change</div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.priceFlash !== false} onChange={e => saveSettings({ priceFlash: e.target.checked })}/>
                  <span className="toggle-slider"/>
                </label>
              </div>
            </div>
          </div>
        )}

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
                <div style={{ fontWeight:600, marginBottom:4, color:'var(--color-sell)' }}>Delete All Data</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:'var(--space-sm)' }}>Permanently remove all your CONE data from this browser</div>
                <button className="btn btn-sell btn-sm" onClick={handleClearAll}><Trash2 size={14}/> Delete All Data</button>
              </div>
            </div>
          </div>
        )}

        {/* About */}
        {cat === 'About' && (
          <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
            <div style={{ textAlign:'center', marginBottom:'var(--space-lg)' }}>
              <svg width="64" height="64" viewBox="0 0 100 100" style={{ display:'block', margin:'0 auto 12px' }}>
                <defs><linearGradient id="ga" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
                <polygon points="50,8 92,88 8,88" fill="url(#ga)"/>
                <polygon points="50,8 74,54 26,54" fill="rgba(255,255,255,0.15)"/>
              </svg>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:800 }}>CONE</div>
              <div style={{ color:'var(--text-muted)', fontSize:13 }}>v{APP_VERSION}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['Version', `v${APP_VERSION}`],
                ['Mode', 'Paper Trading (Simulated)'],
                ['Currency', 'CONE Coins (Virtual)'],
                ['Data Source', 'Mock Feed + Upstox API (optional)'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'8px 0', borderBottom:'1px solid var(--border-glass)' }}>
                  <span style={{ color:'var(--text-muted)' }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="alert alert-warning" style={{ marginTop:'var(--space-lg)', fontSize:12 }}>
              ⚠️ CONE is a paper trading app for educational purposes only. All prices are simulated. No real money is involved. Past performance in simulation does not guarantee real-world results.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
