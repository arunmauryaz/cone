/* Analytics.jsx */
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useMarket } from '../context/MarketContext.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { formatCurrency, formatPercent, fmtPrice, formatDate } from '../utils/formatting.js';
import { calcWinRate, calcProfitFactor, calcMaxDrawdown } from '../utils/calculations.js';
import { getPortfolioHistory } from '../utils/storage.js';
import { STARTING_BALANCE } from '../utils/constants.js';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="glass-card" style={{ padding:'var(--space-md)' }}>
      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:22, fontWeight:800, color: color || 'var(--text-primary)', marginBottom:2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const { user }    = useAuth();
  const { orders, holdings } = usePortfolio();
  const { prices }  = useMarket();
  const [period, setPeriod] = useState('ALL');

  const history = useMemo(() => getPortfolioHistory(user?.username) || [], [user?.username]);

  const chartData = useMemo(() => {
    const now = Date.now();
    const cutoffs = { '1M':2592000000, '3M':7776000000, '6M':15552000000, '1Y':31536000000, 'ALL':Infinity };
    return history
      .filter(h => now - h.timestamp <= (cutoffs[period]||Infinity))
      .map(h => ({ time: Math.floor(h.timestamp/1000), value: h.totalValue }));
  }, [history, period]);

  const closedTrades = useMemo(() => orders.filter(o => o.status === 'COMPLETE' && o.realizedPnL != null), [orders]);
  const winRate      = calcWinRate(closedTrades);
  const profitFactor = calcProfitFactor(closedTrades);
  const maxDrawdown  = calcMaxDrawdown(history.map(h => ({ totalValue: h.totalValue })));

  const wins  = closedTrades.filter(t => (t.realizedPnL||0) > 0);
  const losses = closedTrades.filter(t => (t.realizedPnL||0) < 0);
  const avgWin  = wins.length  ? wins.reduce((s,t)=>s+(t.realizedPnL||0),0)/wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s,t)=>s+Math.abs(t.realizedPnL||0),0)/losses.length : 0;

  // Best/worst day from history
  const dayReturns = history.reduce((acc, h, i, arr) => {
    if (i === 0) return acc;
    const dayKey = new Date(h.timestamp).toDateString();
    const diff   = h.totalValue - arr[i-1].totalValue;
    if (!acc[dayKey] || Math.abs(diff) > Math.abs(acc[dayKey])) acc[dayKey] = diff;
    return acc;
  }, {});
  const dayVals = Object.values(dayReturns);
  const bestDay  = dayVals.length ? Math.max(...dayVals) : 0;
  const worstDay = dayVals.length ? Math.min(...dayVals) : 0;

  // P&L by stock
  const pnlByStock = useMemo(() => {
    const map = {};
    closedTrades.forEach(t => {
      const sym = t.tradingsymbol || t.instrumentKey?.split('|')[1] || 'Unknown';
      map[sym] = (map[sym] || 0) + (t.realizedPnL || 0);
    });
    return Object.entries(map).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10);
  }, [closedTrades]);

  const maxAbs = pnlByStock.length ? Math.max(...pnlByStock.map(([,v]) => Math.abs(v))) : 1;

  // Monthly P&L
  const monthlyPnL = useMemo(() => {
    const map = {};
    closedTrades.forEach(t => {
      const d   = new Date(t.executedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      map[key]  = (map[key]||0) + (t.realizedPnL||0);
    });
    return map;
  }, [closedTrades]);

  const months = Object.keys(monthlyPnL).sort();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Equity Curve */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
          <span className="section-title">Equity Curve</span>
          <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-full)', padding:3 }}>
            {['1M','3M','6M','1Y','ALL'].map(p => (
              <button key={p} className="pill" onClick={() => setPeriod(p)} style={{ background: period===p ? 'var(--gradient-primary)' : 'transparent', color: period===p ? '#fff' : 'var(--text-secondary)' }}>{p}</button>
            ))}
          </div>
        </div>
        {chartData.length > 1 ? (
          <LineChart data={chartData} height={220} color="#8b5cf6" />
        ) : (
          <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:13 }}>
            No history yet. Start trading to see your equity curve.
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)' }}>
        <StatCard label="Total Trades" value={closedTrades.length} sub="completed"/>
        <StatCard label="Win Rate" value={formatPercent(winRate)} color={winRate>=50?'var(--color-buy)':'var(--color-sell)'} sub={`${wins.length}W / ${losses.length}L`}/>
        <StatCard label="Avg Win" value={formatCurrency(avgWin)} color="var(--color-buy)" sub="per winning trade"/>
        <StatCard label="Avg Loss" value={formatCurrency(avgLoss)} color="var(--color-sell)" sub="per losing trade"/>
        <StatCard label="Profit Factor" value={profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)} color={profitFactor>=1?'var(--color-buy)':'var(--color-sell)'}/>
        <StatCard label="Max Drawdown" value={formatPercent(-maxDrawdown)} color={maxDrawdown>10?'var(--color-sell)':'var(--color-neutral)'} sub="from peak"/>
        <StatCard label="Best Day" value={formatCurrency(bestDay, true)} color="var(--color-buy)"/>
        <StatCard label="Worst Day" value={formatCurrency(worstDay, true)} color="var(--color-sell)"/>
      </div>

      {/* P&L by Stock */}
      {pnlByStock.length > 0 && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>P&L by Stock</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pnlByStock.map(([sym, val]) => (
              <div key={sym} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:80, fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>{sym}</div>
                <div style={{ flex:1, height:28, position:'relative', background:'rgba(255,255,255,0.04)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{
                    position:'absolute', top:0, bottom:0, left:0,
                    width:`${(Math.abs(val)/maxAbs)*100}%`,
                    background: val >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)',
                    borderRadius:4, transition:'width 600ms ease',
                  }}/>
                  <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:12, fontWeight:700, fontFamily:"'Space Grotesk',monospace", color: val>=0?'var(--color-buy)':'var(--color-sell)' }}>
                    {formatCurrency(val, true)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly heatmap */}
      {months.length > 0 && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Monthly P&L</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {months.map(m => {
              const val = monthlyPnL[m];
              const intensity = Math.min(Math.abs(val) / 5000, 1);
              const bg = val >= 0
                ? `rgba(16,185,129,${0.1 + intensity * 0.6})`
                : `rgba(239,68,68,${0.1 + intensity * 0.6})`;
              return (
                <div key={m} style={{ padding:'8px 12px', borderRadius:'var(--radius-md)', background: bg, minWidth:90, textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>{m}</div>
                  <div style={{ fontSize:12, fontWeight:700, color: val>=0?'var(--color-buy)':'var(--color-sell)', fontFamily:"'Space Grotesk',monospace" }}>
                    {formatCurrency(val, true)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Trade Log <span className="count">{closedTrades.length}</span></div>
        {closedTrades.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Instrument</th><th>Side</th><th className="col-right">Qty</th><th className="col-right">Price</th><th className="col-right">P&L</th></tr></thead>
              <tbody>
                {closedTrades.slice(0, 50).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize:11, color:'var(--text-muted)' }}>{formatDate(t.executedAt)}</td>
                    <td style={{ fontWeight:600 }}>{t.tradingsymbol}</td>
                    <td style={{ color: t.side==='BUY'?'var(--color-buy)':'var(--color-sell)', fontWeight:600 }}>{t.side}</td>
                    <td className="col-right">{t.qty}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(t.price)}</td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, color:(t.realizedPnL||0)>=0?'var(--color-buy)':'var(--color-sell)' }}>
                      {formatCurrency(t.realizedPnL||0, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No closed trades yet</div>
        )}
      </div>
    </div>
  );
}
