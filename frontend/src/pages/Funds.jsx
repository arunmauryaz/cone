/* Funds.jsx */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { formatCurrency, formatDateTime } from '../utils/formatting.js';

function AddCoinsModal({ onClose, onAdd }) {
  const [custom, setCustom] = useState('');
  const presets = [10000, 25000, 50000, 100000];
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="glass-card modal-enter" style={{ width: '100%', maxWidth: 380, padding: 'var(--space-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600 }}>Add Virtual Balance</h2>
          <button className="btn-icon" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)', fontSize: 11 }}>
          CONE Coins are virtual currency only. Maximum balance: C 10,00,000.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 'var(--space-md)' }}>
          {presets.map(p => (
            <button key={p} className="btn btn-ghost" style={{ fontSize: 12, fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }} onClick={() => onAdd(p)}>
              + C {(p/1000)}K
            </button>
          ))}
        </div>
        <div className="input-group">
          <label className="input-label">Custom Amount</label>
          <input className="input" type="number" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Enter amount" min="1" max="1000000"/>
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop: 'var(--space-md)' }} onClick={() => { if (custom) { onAdd(parseFloat(custom)); onClose(); } }}>
          Add Balance
        </button>
      </div>
    </div>
  );
}

export default function Funds() {
  const { wallet, addCoins } = usePortfolio();
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 15;

  const transactions = wallet?.transactions || [];
  const paged = transactions.slice((page-1)*PER_PAGE, page*PER_PAGE);
  const totalPages = Math.ceil(transactions.length / PER_PAGE);

  function handleAdd(amount) {
    addCoins(amount);
    setShowModal(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {showModal && <AddCoinsModal onClose={() => setShowModal(false)} onAdd={handleAdd}/>}

      <div className="alert alert-warning">
        🪙 CONE Coins are virtual currency for simulation trading only.
      </div>

      <div className="responsive-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        {/* Equity Funds */}
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Equity Funds</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700 }}>
                {formatCurrency(wallet?.balance ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Available Virtual Trading Balance</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={13}/> Add Coins</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            {[
              ['Opening Balance', formatCurrency(wallet?.openingBalance ?? 100000)],
              ['Used Margin',     formatCurrency(wallet?.usedMargin ?? 0)],
              ['Today Payin',     formatCurrency(wallet?.todayPayin ?? 0)],
              ['Today Payout',    formatCurrency(wallet?.todayPayout ?? 0)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Commodity Funds */}
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Commodity Segment</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 24, fontWeight: 700, color: 'var(--text-tertiary)' }}>C 0.00</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Not configured for simulation</div>
          </div>
          <div className="alert alert-info" style={{ fontSize: 11 }}>
            Commodity futures and options trading feed is available when live Upstox API credentials are configured in Settings.
          </div>
        </div>
      </div>

      {/* Transactions */}
      {transactions.length > 0 && (
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Fund History <span className="count">{transactions.length}</span></div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date & Time</th><th>Type</th><th>Description</th><th className="col-right">Amount</th><th className="col-right">Balance</th></tr></thead>
              <tbody>
                {paged.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(t.timestamp)}</td>
                    <td><span style={{ fontSize: 11, fontWeight: 600, color: t.type === 'CREDIT' ? 'var(--price-up)' : 'var(--price-down)' }}>{t.type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.description}</td>
                    <td className="col-right" style={{ color: t.amount >= 0 ? 'var(--price-up)' : 'var(--price-down)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)}
                    </td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(t.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span style={{ fontSize: 11, alignSelf: 'center', color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
