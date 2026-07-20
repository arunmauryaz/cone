/* Holdings.jsx */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useMarket } from '../context/MarketContext.jsx';
import { formatCurrency, formatPercent, fmtPrice } from '../utils/formatting.js';

export default function Holdings() {
  const { holdings, openOrderModal } = usePortfolio();
  const { prices } = useMarket();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('currentVal');
  const [sortDir, setSortDir] = useState(-1);

  const enriched = useMemo(() => holdings.map(h => {
    const ltp        = prices.get(h.instrumentKey)?.ltp ?? h.avgCost;
    const currentVal = ltp * h.qty;
    const invested   = h.avgCost * h.qty;
    const pnl        = currentVal - invested;
    const pnlPct     = invested > 0 ? (pnl / invested) * 100 : 0;
    const dayChg     = prices.get(h.instrumentKey)?.changePercent ?? 0;
    return { ...h, ltp, currentVal, invested, pnl, pnlPct, dayChg };
  }), [holdings, prices]);

  const sorted = [...enriched].sort((a, b) => sortDir * (a[sortBy] < b[sortBy] ? 1 : -1));

  const totalInvested = sorted.reduce((s,h) => s + h.invested, 0);
  const totalCurrent  = sorted.reduce((s,h) => s + h.currentVal, 0);
  const totalPnL      = totalCurrent - totalInvested;
  const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => -d);
    else { setSortBy(col); setSortDir(-1); }
  }

  const thStyle = { cursor:'pointer' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)' }}>
        {[
          { label:'Total Invested', value: formatCurrency(totalInvested), color:'var(--text-primary)' },
          { label:'Current Value',  value: formatCurrency(totalCurrent),  color:'var(--text-primary)' },
          { label:'Total P&L',      value: formatCurrency(totalPnL, true), color: totalPnL >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' },
          { label:'Return',         value: formatPercent(totalPnLPct),     color: totalPnLPct >= 0 ? 'var(--color-buy)' : 'var(--color-sell)' },
        ].map(c => (
          <div key={c.label} className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:20, fontWeight:700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Holdings <span className="count">{holdings.length}</span></div>
        {sorted.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('qty')}>Qty {sortBy==='qty'?(sortDir>0?'▲':'▼'):''}</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('avgCost')}>Avg Cost {sortBy==='avgCost'?(sortDir>0?'▲':'▼'):''}</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('ltp')}>LTP {sortBy==='ltp'?(sortDir>0?'▲':'▼'):''}</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('currentVal')}>Current Val {sortBy==='currentVal'?(sortDir>0?'▲':'▼'):''}</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('pnl')}>P&L {sortBy==='pnl'?(sortDir>0?'▲':'▼'):''}</th>
                  <th className="col-right" style={thStyle} onClick={() => toggleSort('pnlPct')}>Net Chg%</th>
                  <th className="col-right">Day Chg%</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(h => (
                  <tr key={h.id} onClick={() => navigate(`/stock/${encodeURIComponent(h.instrumentKey)}`)}>
                    <td>
                      <div style={{ fontWeight:600 }}>{h.tradingsymbol}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{h.instrumentKey?.split('|')[0]}</div>
                    </td>
                    <td className="col-right" style={{ fontWeight:600 }}>{h.qty}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(h.avgCost)}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600 }}>C {fmtPrice(h.ltp)}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(h.currentVal)}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color: h.pnl>=0?'var(--color-buy)':'var(--color-sell)' }}>
                      {formatCurrency(h.pnl, true)}<br/><span style={{ fontSize:10, fontWeight:400 }}>{formatPercent(h.pnlPct)}</span>
                    </td>
                    <td className="col-right" style={{ color: h.pnlPct>=0?'var(--color-buy)':'var(--color-sell)', fontWeight:600 }}>{formatPercent(h.pnlPct)}</td>
                    <td className="col-right" style={{ color: h.dayChg>=0?'var(--color-buy)':'var(--color-sell)', fontWeight:600 }}>
                      {h.dayChg>=0?'+':''}{h.dayChg.toFixed(2)}%
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openOrderModal({ instrumentKey:h.instrumentKey, side:'BUY'  })}>Buy</button>
                        <button className="btn btn-sell  btn-sm" onClick={() => openOrderModal({ instrumentKey:h.instrumentKey, side:'SELL' })}>Sell</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-footer-row">
                  <td colSpan={4}><strong>Total</strong></td>
                  <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700 }}>C {fmtPrice(totalCurrent)}</td>
                  <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color: totalPnL>=0?'var(--color-buy)':'var(--color-sell)' }}>{formatCurrency(totalPnL, true)}</td>
                  <td className="col-right" style={{ color: totalPnLPct>=0?'var(--color-buy)':'var(--color-sell)', fontWeight:700 }}>{formatPercent(totalPnLPct)}</td>
                  <td/><td/>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            No holdings yet. Buy stocks from Market page using CNC product.
          </div>
        )}
      </div>
    </div>
  );
}
