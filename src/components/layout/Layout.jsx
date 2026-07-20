/* Layout.jsx */
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MarketTicker from './MarketTicker.jsx';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import OrderModal from '../trading/OrderModal.jsx';
import CommandPalette from '../common/CommandPalette.jsx';
import { getSidebarCollapsed } from '../../utils/storage.js';

export default function Layout() {
  const [collapsed, setCollapsed]   = useState(getSidebarCollapsed());
  const [paletteOpen, setPaletteOpen] = useState(false);

  const sidebarW = collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';

  // Global Ctrl+K
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Fixed ticker bar at very top */}
      <MarketTicker />

      <div style={{ display: 'flex', paddingTop: 'var(--ticker-height)' }}>
        {/* Fixed sidebar */}
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        {/* Main content area */}
        <div style={{
          flex: 1,
          marginLeft: sidebarW,
          transition: 'margin-left 200ms ease',
          minHeight: 'calc(100vh - var(--ticker-height))',
        }}>
          {/* Top bar */}
          <TopBar onSearchOpen={() => setPaletteOpen(true)} sidebarWidth={sidebarW} />

          {/* Page content */}
          <main style={{
            paddingTop: 'var(--topbar-height)',
            minHeight: 'calc(100vh - var(--ticker-height) - var(--topbar-height))',
            padding: `calc(var(--topbar-height) + var(--space-lg)) var(--space-lg) var(--space-lg)`,
          }}>
            <div className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Global order modal */}
      <OrderModal />

      {/* Command palette */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(15,15,26,0.98)',
            color: '#f0f0f8',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
}
