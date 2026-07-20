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
      <div className="glass-card modal-enter" style={{ width:'100%', maxWidth:400, padding:'var(--space-xl)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-lg)' }}>
          <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18 }}>Add CONE Coins</h2>
          <button className="btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="alert alert-info" style={{ marginBottom:'var(--space-md)', fontSize:12 }}>
          CONE Coins are virtual currency only. Maximum balance: C 10,00,000.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'var(--space-md)' }}>
          {presets.map(p => (
            <button key={p} className="btn btn-ghost" style={{ fontSize:13, fontWeight:600 }} onClick={() => onAdd(p)}>
              + C {(p/1000)}K
            </button>
          ))}
        </div>
        <div className="input-group">
          <label className="input-label">Custom Amount</label>
          <input className="input" type="number" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Enter amount" min="1" max="1000000"/>
        </div>
        <button className="btn btn-primary btn-full" style={{ marginTop:'var(--space-md)' }} onClick={() => { if (custom) { onAdd(parseFloat(custom)); onClose(); } }}>
          Add Custom Amount
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
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {showModal && <AddCoinsModal onClose={() => setShowModal(false)} onAdd={handleAdd}/>}

      <div className="alert alert-warning">
        🪙 CONE Coins are virtual currency for paper trading only. No real money is involved.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
        {/* Equity Funds */}
        <div className="glass-card gradient" style={{ padding:'var(--space-lg)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'var(--space-lg)' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Equity Funds</div>
              <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:30, fontWeight:800 }}>
                {formatCurrency(wallet?.balance ?? 0)}
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>Available CONE Coins</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14}/> Add Coins</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              ['Opening Balance', formatCurrency(wallet?.openingBalance ?? 100000)],
              ['Used Margin',     formatCurrency(wallet?.usedMargin ?? 0)],
              ['Today Payin',     formatCurrency(wallet?.todayPayin ?? 0)],
              ['Today Payout',    formatCurrency(wallet?.todayPayout ?? 0)],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Commodity Funds (placeholder) */}
        <div className="glass-card" style={{ padding:'var(--space-lg)' }}>
          <div style={{ marginBottom:'var(--space-lg)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Commodity Funds</div>
            <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:30, fontWeight:800, color:'var(--text-muted)' }}>C 0.00</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Not available in paper mode</div>
          </div>
          <div className="alert alert-info" style={{ fontSize:12 }}>
            Commodity segment is available in the full version.
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Transaction History <span className="count">{transactions.length}</span></div>
        {paged.length > 0 ? (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Date & Time</th><th>Description</th><th className="col-right">Amount</th><th className="col-right">Balance</th></tr></thead>
                <tbody>
                  {paged.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontSize:11, color:'var(--text-muted)' }}>{formatDateTime(tx.timestamp)}</td>
                      <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.description}</td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color: tx.type==='CREDIT'?'var(--color-buy)':'var(--color-sell)' }}>
                        {tx.type==='CREDIT'?'+':''}{formatCurrency(tx.amount)}
                      </td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>{formatCurrency(tx.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:'var(--space-md)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>← Prev</button>
                <span style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:'28px' }}>Page {page} / {totalPages}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Next →</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No transactions yet</div>
        )}
      </div>
    </div>
  );
}
