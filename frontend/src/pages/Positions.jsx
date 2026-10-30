/* Positions.jsx */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useMarket } from '../context/MarketContext.jsx';
import { calcUnrealizedPnL } from '../utils/calculations.js';
import { formatCurrency, formatPercent, fmtPrice } from '../utils/formatting.js';
import Badge from '../components/common/Badge.jsx';

export default function Positions() {
  const { positions, orders, exitPosition, openOrderModal, todayPnL } = usePortfolio();
  const { prices } = useMarket();
  const navigate = useNavigate();

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
  const realizedToday = todayPnL?.realized ?? closedToday.reduce((s,o) => s + (o.realizedPnL||0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Summary bar */}
      <div className="responsive-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-md)' }}>
        {[
          { label: 'Open Positions', value: positions.length, suffix: '', color: 'var(--text-primary)' },
          { label: 'Unrealized P&L', value: formatCurrency(totalPnL, true), suffix: '', color: totalPnL >= 0 ? 'var(--price-up)' : 'var(--price-down)' },
          { label: "Today's Realized", value: formatCurrency(realizedToday, true), suffix: '', color: realizedToday >= 0 ? 'var(--price-up)' : 'var(--price-down)' },
        ].map(c => (
          <div key={c.label} className="glass-card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Positions table */}
      <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Open Positions <span className="count">{positions.length}</span></div>
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
                  <tr key={p.id} onClick={() => navigate(`/stock/${encodeURIComponent(p.instrumentKey)}`)}>
                    <td><Badge type={p.product}>{p.product}</Badge></td>
                    <td style={{ fontWeight: 600 }}>{p.tradingsymbol}</td>
                    <td className="col-right" style={{ fontWeight: 600, color: p.qty > 0 ? 'var(--price-up)' : 'var(--price-down)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{p.qty > 0 ? '+' : ''}{p.qty}</td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(p.avgCost)}</td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtPrice(p.ltp)}</td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: p.pnl >= 0 ? 'var(--price-up)' : 'var(--price-down)' }}>
                      {formatCurrency(p.pnl, true)}<br/><span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{formatPercent(p.pnlPct)}</span>
                    </td>
                    <td className="col-right" style={{ color: p.chgPct >= 0 ? 'var(--price-up)' : 'var(--price-down)', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                      {p.chgPct >= 0 ? '+' : ''}{p.chgPct.toFixed(2)}%
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openOrderModal({ instrumentKey: p.instrumentKey, side: p.qty < 0 ? 'SELL' : 'BUY' })}>+Add</button>
                        <button className="btn btn-sell btn-sm" onClick={() => { if(window.confirm('Exit this position at market price?')) exitPosition(p.id); }}>Exit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No open positions. Use MIS product for intraday positions.
          </div>
        )}
      </div>

      {/* Today's closed trades */}
      {closedToday.length > 0 && (
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Today's Closed Trades <span className="count">{closedToday.length}</span></div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th className="col-right">Qty</th><th className="col-right">Price</th><th className="col-right">P&L</th></tr></thead>
              <tbody>
                {closedToday.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{new Date(o.executedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ fontWeight: 600 }}>{o.tradingsymbol}</td>
                    <td><Badge type={o.side}>{o.side}</Badge></td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{o.qty}</td>
                    <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtPrice(o.price)}</td>
                    <td className="col-right" style={{ color: o.realizedPnL >= 0 ? 'var(--price-up)' : 'var(--price-down)', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(o.realizedPnL, true)}
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
