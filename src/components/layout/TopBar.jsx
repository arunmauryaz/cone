/* TopBar.jsx */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Search, ChevronDown, User, Settings, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useMarket } from '../../context/MarketContext.jsx';

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/market':        'Market',
  '/orders':        'Orders',
  '/positions':     'Positions',
  '/holdings':      'Holdings',
  '/funds':         'Funds',
  '/analytics':     'Analytics',
  '/settings':      'Settings',
  '/notifications': 'Notifications',
};

export default function TopBar({ onSearchOpen }) {
  const { user, logout } = useAuth();
  const { unreadCount } = usePortfolio();
  const { marketStatus } = useMarket();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUser, setShowUser] = useState(false);
  const dropRef = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/stock/') ? 'Stock Detail' : 'CONE');

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowUser(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const avatarColor = stringToColor(user?.username || '');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header style={{
      position: 'fixed', top: 'var(--ticker-height)', right: 0,
      left: 'var(--sidebar-current-width, var(--sidebar-width))',
      height: 'var(--topbar-height)', zIndex: 90,
      background: 'rgba(15,15,26,0.92)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-glass)',
      display: 'flex', alignItems: 'center', padding: '0 var(--space-lg)',
      gap: 'var(--space-md)', transition: 'left 200ms ease',
    }}>
      {/* Page title */}
      <h1 style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", flex: '0 0 auto', minWidth: 120 }}>
        {pageTitle}
      </h1>

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        style={{
          flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-input)', border: '1px solid var(--border-glass)',
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          fontFamily: "'Inter', sans-serif", transition: 'all 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <Search size={14} />
        <span>Search stocks, pages...</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>Ctrl K</span>
      </button>

      <div style={{ flex: 1 }} />

      {/* Market status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
        <span className={marketStatus === 'OPEN' ? 'pulse' : ''} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: marketStatus === 'OPEN' ? 'var(--color-buy)' : 'var(--color-sell)',
          display: 'inline-block',
        }} />
        <span style={{ color: marketStatus === 'OPEN' ? 'var(--color-buy)' : 'var(--text-muted)' }}>
          {marketStatus === 'OPEN' ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </span>
      </div>

      {/* Notification bell */}
      <button className="btn-icon" style={{ position: 'relative' }} onClick={() => navigate('/notifications')}>
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: 'var(--color-sell)', color: '#fff',
            fontSize: 9, fontWeight: 700, borderRadius: '50%',
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* User avatar dropdown */}
      <div ref={dropRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowUser(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: 'none', border: 'none', padding: '4px 8px',
            borderRadius: 'var(--radius-md)', transition: 'background 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 100 }} className="truncate">
            {user?.username}
          </span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {showUser && (
          <div className="glass-card fade-in" style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8,
            minWidth: 180, zIndex: 200, overflow: 'hidden',
          }}>
            <div style={{ padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--border-glass)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.fullName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{user?.username}</div>
            </div>
            {[
              { icon: User, label: 'Profile', action: () => { navigate('/settings'); setShowUser(false); }},
              { icon: Settings, label: 'Settings', action: () => { navigate('/settings'); setShowUser(false); }},
              { icon: Zap, label: 'Analytics', action: () => { navigate('/analytics'); setShowUser(false); }},
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={action} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px var(--space-md)',
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Icon size={14} />{label}
              </button>
            ))}
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px var(--space-md)',
              background: 'none', border: 'none', color: 'var(--color-sell)',
              fontSize: 13, cursor: 'pointer', borderTop: '1px solid var(--border-glass)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <LogOut size={14} />Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function stringToColor(str) {
  const colors = ['#6366f1','#10b981','#f97316','#3b82f6','#ec4899','#8b5cf6','#06b6d4','#f59e0b'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
