/* Positions.jsx */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useMarket } from '../context/MarketContext.jsx';
import { calcUnrealizedPnL } from '../utils/calculations.js';
import { formatCurrency, formatPercent, fmtPrice } from '../utils/formatting.js';
import Badge from '../components/common/Badge.jsx';

export default function Positions() {
  const { positions, orders, exitPosition, openOrderModal } = usePortfolio();
  const { prices } = useMarket();
  const navigate = useNavigate();
  const [confirmExit, setConfirmExit] = useState(null);

  const enriched = useMemo(() => positions.map(p => {
    const ltp  = prices.get(p.instrumentKey)?.ltp ?? p.avgCost;
    const pnl  = calcUnrealizedPnL(ltp, p.avgCost, p.qty);
    const pnlPct = p.avgCost > 0 ? ((ltp - p.avgCost) / p.avgCost) * 100 : 0;
    const chgPct = prices.get(p.instrumentKey)?.changePercent ?? 0;
    return { ...p, ltp, pnl, pnlPct, chgPct };
  }), [positions, prices]);

  const totalPnL = enriched.reduce((s, p) => s + p.pnl, 0);

  // Closed today
  const today = new Date(); today.setHours(0,0,0,0);
  const closedToday = orders.filter(o =>
    o.status === 'COMPLETE' && o.realizedPnL != null && new Date(o.executedAt) >= today
  );
  const realizedToday = closedToday.reduce((s,o) => s + (o.realizedPnL||0), 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--space-md)' }}>
        {[
          { label:'Open Positions', value: positions.length, suffix:'', color:'var(--text-primary)' },
          { label:'Unrealized P&L', value: formatCurrency(totalPnL, true), suffix:'', color: totalPnL >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' },
          { label:"Today's Realized", value: formatCurrency(realizedToday, true), suffix:'', color: realizedToday >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' },
        ].map(c => (
          <div key={c.label} className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:22, fontWeight:700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Positions table */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Open Positions <span className="count">{positions.length}</span></div>
        {enriched.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th><th>Instrument</th><th className="col-right">Qty</th><th className="col-right">Avg Cost</th>
                  <th className="col-right">LTP</th><th className="col-right">P&L</th><th className="col-right">Chg%</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map(p => (
                  <>
                    <tr key={p.id} onClick={() => navigate(`/stock/${encodeURIComponent(p.instrumentKey)}`)}>
                      <td><Badge type={p.product}>{p.product}</Badge></td>
                      <td style={{ fontWeight:600 }}>{p.tradingsymbol}</td>
                      <td className="col-right" style={{ fontWeight:700, color: p.qty > 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}>{p.qty > 0 ? '+' : ''}{p.qty}</td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(p.avgCost)}</td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600 }}>C {fmtPrice(p.ltp)}</td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color: p.pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}>
                        {formatCurrency(p.pnl, true)}<br/><span style={{ fontSize:10, fontWeight:400 }}>{formatPercent(p.pnlPct)}</span>
                      </td>
                      <td className="col-right" style={{ color: p.chgPct >= 0 ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
                        {p.chgPct >= 0 ? '+' : ''}{p.chgPct.toFixed(2)}%
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openOrderModal({ instrumentKey: p.instrumentKey, side:'BUY' })}>+Add</button>
                          <button className="btn btn-sell btn-sm" onClick={() => setConfirmExit(p.id)}>Exit</button>
                        </div>
                      </td>
                    </tr>
                    {confirmExit === p.id && (
                      <tr key={p.id + '_confirm'}>
                        <td colSpan={8}>
                          <div style={{ padding:'8px 12px', background:'rgba(239,68,68,0.08)', borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', gap:12 }}>
                            <span style={{ fontSize:13, color:'var(--text-secondary)' }}>Exit all {p.qty} shares of {p.tradingsymbol} at market price?</span>
                            <button className="btn btn-sell btn-sm" onClick={() => { exitPosition(p.id); setConfirmExit(null); }}>Confirm Exit</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmExit(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            No open positions. Use MIS product for intraday positions.
          </div>
        )}
      </div>

      {/* Today's closed trades */}
      {closedToday.length > 0 && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Today's Closed Trades <span className="count">{closedToday.length}</span></div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th className="col-right">Qty</th><th className="col-right">Price</th><th className="col-right">P&L</th></tr></thead>
              <tbody>
                {closedToday.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(o.executedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ fontWeight:600 }}>{o.tradingsymbol}</td>
                    <td><Badge type={o.side}>{o.side}</Badge></td>
                    <td className="col-right">{o.qty}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(o.price)}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color: (o.realizedPnL||0) >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}>
                      {formatCurrency(o.realizedPnL||0, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
