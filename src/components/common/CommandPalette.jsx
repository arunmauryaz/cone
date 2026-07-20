/* CommandPalette.jsx */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, ShoppingCart, BarChart2, Package, Wallet, Gavel, PieChart, Trophy, Settings } from 'lucide-react';
import { useMarket } from '../../context/MarketContext.jsx';
import { fmtPrice } from '../../utils/formatting.js';

const PAGES = [
  { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard },
  { label: 'Market',      path: '/market',       icon: TrendingUp },
  { label: 'Orders',      path: '/orders',       icon: ShoppingCart },
  { label: 'Positions',   path: '/positions',    icon: BarChart2 },
  { label: 'Holdings',    path: '/holdings',     icon: Package },
  { label: 'Funds',       path: '/funds',        icon: Wallet },
  { label: 'Bids & IPO',  path: '/bids',         icon: Gavel },
  { label: 'Analytics',   path: '/analytics',    icon: PieChart },
  { label: 'Leaderboard', path: '/leaderboard',  icon: Trophy },
  { label: 'Settings',    path: '/settings',     icon: Settings },
];

export default function CommandPalette({ onClose }) {
  const [query, setQuery]     = useState('');
  const [selected, setSelected] = useState(0);
  const { searchInstruments, getPrice } = useMarket();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const instruments = query.length >= 1 ? searchInstruments(query).slice(0, 6) : [];
  const pages       = PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase())).slice(0, 4);

  const allResults = [
    ...instruments.map(i => ({ type: 'stock', ...i })),
    ...pages.map(p => ({ type: 'page', ...p })),
  ];

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelected(0); }, [query]);

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && allResults[selected]) select(allResults[selected]);
    if (e.key === 'Escape') onClose();
  }

  function select(item) {
    if (item.type === 'stock') navigate(`/stock/${encodeURIComponent(item.instrumentKey)}`);
    else navigate(item.path);
    onClose();
  }

  return (
    <div className="overlay-backdrop" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '15vh' }}>
      <div
        className="glass-card modal-enter"
        style={{ width: '100%', maxWidth: 560, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-glass)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search stocks, pages..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 16, fontFamily: "'Inter', sans-serif",
            }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {allResults.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {query ? 'No results found' : 'Start typing to search stocks or pages'}
            </div>
          )}

          {instruments.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stocks</div>
              {instruments.map((inst, i) => {
                const price = getPrice(inst.instrumentKey);
                const isActive = selected === i;
                return (
                  <button key={inst.instrumentKey} onClick={() => select({ type: 'stock', ...inst })} style={{
                    display: 'flex', alignItems: 'center', width: '100%', padding: '9px 16px',
                    background: isActive ? 'var(--bg-card-hover)' : 'none',
                    border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', gap: 12,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', flexShrink: 0 }}>
                      {inst.tradingsymbol?.slice(0, 3)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{inst.tradingsymbol}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inst.name}</div>
                    </div>
                    {price && (
                      <div style={{ textAlign: 'right', fontSize: 13 }}>
                        <div style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 600 }}>C {fmtPrice(price.ltp)}</div>
                        <div style={{ fontSize: 11, color: (price.changePercent || 0) >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}>
                          {(price.changePercent || 0) >= 0 ? '+' : ''}{(price.changePercent || 0).toFixed(2)}%
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {pages.length > 0 && (
            <div style={{ padding: '6px 0', borderTop: instruments.length ? '1px solid var(--border-glass)' : 'none' }}>
              <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pages</div>
              {pages.map((page, i) => {
                const idx = instruments.length + i;
                const Icon = page.icon;
                return (
                  <button key={page.path} onClick={() => select({ type: 'page', ...page })} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px',
                    background: selected === idx ? 'var(--bg-card-hover)' : 'none',
                    border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                  }}>
                    <Icon size={16} />{page.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
