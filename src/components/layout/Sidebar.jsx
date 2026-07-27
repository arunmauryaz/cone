/* Sidebar.jsx */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, ClipboardList, Layers, BookOpen,
  Wallet, BarChart2, Settings, ChevronLeft, ChevronRight,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/market',      icon: TrendingUp,      label: 'Market' },
  { to: '/orders',      icon: ClipboardList,   label: 'Orders' },
  { to: '/positions',   icon: Layers,          label: 'Positions' },
  { to: '/holdings',    icon: BookOpen,        label: 'Holdings' },
  { to: '/funds',       icon: Wallet,          label: 'Funds' },
  { to: '/analytics',   icon: BarChart2,       label: 'Analytics' },
];

const STORAGE_KEY = 'cone_sidebar_collapsed';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) === true; } catch { return false; }
  });
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  const width = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  return (
    <aside
      style={{
        position: 'fixed',
        top: 'var(--ticker-height)',
        left: 0,
        bottom: 0,
        width,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 200ms ease',
        zIndex: 900,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 'var(--topbar-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 10,
          borderBottom: '1px solid var(--border-glass)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={() => navigate('/dashboard')}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--gradient-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'var(--shadow-glow)',
        }}>
          <Zap size={18} color="#fff" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            whiteSpace: 'nowrap',
          }}>
            CONE
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 16px',
              margin: '2px 8px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              boxSizing: 'border-box',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} style={{ flexShrink: 0, color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings + Collapse */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-glass)', padding: '8px 0' }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 16px',
            margin: '2px 8px',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease',
            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
            borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
          })}
        >
          {({ isActive }) => (
            <>
              <Settings size={18} style={{ flexShrink: 0, color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
              {!collapsed && <span>Settings</span>}
            </>
          )}
        </NavLink>

        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 16px',
            margin: '2px 8px',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '13px',
            width: 'calc(100% - 16px)',
            transition: 'all 150ms ease',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} style={{ flexShrink: 0 }} /> : <ChevronLeft size={18} style={{ flexShrink: 0 }} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
