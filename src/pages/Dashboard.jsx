/* Dashboard.jsx */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, TrendingDown, BarChart2, ArrowRight, ShoppingCart, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useMarket } from '../context/MarketContext.jsx';
import { useLivePrice } from '../hooks/useLivePrice.js';
import LineChart from '../components/charts/LineChart.jsx';
import { formatCurrency, formatPercent, formatLongDate, getGreeting, fmtPrice } from '../utils/formatting.js';
import { calcUnrealizedPnL, calcTodayPnL } from '../utils/calculations.js';
import { getPortfolioHistory } from '../utils/storage.js';
import { INDEX_STOCKS, STARTING_BALANCE } from '../utils/constants.js';
import Badge from '../components/common/Badge.jsx';

/* ---- Mini index row ---- */
function IndexRow({ stock }) {
  const price = useLivePrice(stock.instrumentKey);
  const ltp   = price?.ltp ?? stock.basePrice;
  const chg   = price?.changePercent ?? 0;
  const isUp  = chg >= 0;
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-glass)' }}>
      <div>
        <div style={{ fontSize:13, fontWeight:600 }}>{stock.tradingsymbol}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{stock.exchange}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, fontSize:14 }}>
          {stock.instrumentKey.includes('VIX') ? ltp.toFixed(2) : fmtPrice(ltp)}
        </div>
        <div style={{ fontSize:11, color: isUp ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
          {isUp ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

/* ---- Metric card ---- */
function MetricCard({ icon: Icon, label, value, sub, valueColor, iconBg }) {
  return (
    <div className="glass-card hoverable" style={{ padding:'var(--space-md)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
          <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:22, fontWeight:700, color: valueColor || 'var(--text-primary)', lineHeight:1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>{sub}</div>}
        </div>
        <div style={{ width:40, height:40, borderRadius:'var(--radius-md)', background: iconBg || 'rgba(139,92,246,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={20} style={{ color: 'var(--accent-primary)' }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user }    = useAuth();
  const { wallet, holdings, positions, orders, totalPortfolioValue, openOrderModal } = usePortfolio();
  const { prices, marketStatus } = useMarket();
  const navigate    = useNavigate();

  const [histPeriod, setHistPeriod] = useState('1M');

  // Portfolio history for chart
  const rawHistory = useMemo(() => getPortfolioHistory(user?.username) || [], [user?.username]);
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const cutoff = { '1D': 86400000, '1W': 604800000, '1M': 2592000000, '3M': 7776000000, 'ALL': Infinity };
    const ms = cutoff[histPeriod] || Infinity;
    return rawHistory
      .filter(h => now - h.timestamp <= ms)
      .map(h => ({ time: Math.floor(h.timestamp / 1000), value: h.totalValue }));
  }, [rawHistory, histPeriod]);

  // Today P&L
  const todayPnL = useMemo(() => calcTodayPnL(orders, positions, prices), [orders, positions, prices]);

  // Overall P&L
  const overallPnL = totalPortfolioValue - STARTING_BALANCE;
  const overallPct = ((overallPnL / STARTING_BALANCE) * 100);

  // Top 5 holdings by current value
  const topHoldings = useMemo(() => {
    return holdings
      .map(h => {
        const ltp    = prices.get(h.instrumentKey)?.ltp ?? h.avgCost;
        const pnl    = (ltp - h.avgCost) * h.qty;
        const pnlPct = ((ltp - h.avgCost) / h.avgCost) * 100;
        return { ...h, ltp, pnl, pnlPct, currentVal: ltp * h.qty };
      })
      .sort((a, b) => b.currentVal - a.currentVal)
      .slice(0, 5);
  }, [holdings, prices]);

  // Top 5 positions
  const topPositions = useMemo(() => {
    return positions
      .map(p => {
        const ltp = prices.get(p.instrumentKey)?.ltp ?? p.avgCost;
        const pnl = calcUnrealizedPnL(ltp, p.avgCost, p.qty);
        return { ...p, ltp, pnl };
      })
      .slice(0, 5);
  }, [positions, prices]);

  const recentOrders = orders.slice(0, 5);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>
      {/* Greeting Banner */}
      <div className="glass-card gradient" style={{ padding:'var(--space-lg)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>
            {getGreeting()}, {user?.fullName?.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>{formatLongDate()}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:'var(--radius-full)', background: marketStatus === 'OPEN' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', border:`1px solid ${marketStatus==='OPEN'?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.2)'}` }}>
          <span className={marketStatus==='OPEN' ? 'pulse' : ''} style={{ width:8, height:8, borderRadius:'50%', background: marketStatus==='OPEN' ? 'var(--color-buy)' : 'var(--color-sell)', display:'inline-block' }}/>
          <span style={{ fontSize:12, fontWeight:700, color: marketStatus==='OPEN' ? 'var(--color-buy)' : 'var(--color-sell)' }}>
            MARKET {marketStatus}
          </span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'var(--space-md)' }}>
        <MetricCard icon={BarChart2} label="Total Portfolio" value={formatCurrency(totalPortfolioValue)} sub={`${overallPnL >= 0 ? '↑' : '↓'} ${formatPercent(overallPct)} overall`} iconBg="rgba(139,92,246,0.15)" />
        <MetricCard icon={Wallet} label="Available Balance" value={formatCurrency(wallet?.balance ?? 0)} sub="CONE Coins" iconBg="rgba(6,182,212,0.15)" />
        <MetricCard icon={todayPnL.total >= 0 ? TrendingUp : TrendingDown} label="Today's P&L"
          value={formatCurrency(todayPnL.total, true)}
          valueColor={todayPnL.total >= 0 ? 'var(--color-buy)' : 'var(--color-sell)'}
          sub={`Realized: ${formatCurrency(todayPnL.realized, true)}`}
          iconBg={todayPnL.total >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)'} />
        <MetricCard icon={overallPnL >= 0 ? TrendingUp : TrendingDown} label="Overall P&L"
          value={formatCurrency(overallPnL, true)}
          valueColor={overallPnL >= 0 ? 'var(--color-buy)' : 'var(--color-sell)'}
          sub={`${formatPercent(overallPct)} since start`}
          iconBg={overallPnL >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)'} />
      </div>

      {/* Chart + Market Overview */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'var(--space-md)' }}>
        {/* Portfolio Chart */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <span className="section-title">Portfolio Value</span>
            <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-full)', padding:3 }}>
              {['1D','1W','1M','3M','ALL'].map(p => (
                <button key={p} onClick={() => setHistPeriod(p)} className="pill" style={{ background: histPeriod===p ? 'var(--gradient-primary)' : 'transparent', color: histPeriod===p ? '#fff' : 'var(--text-secondary)' }}>{p}</button>
              ))}
            </div>
          </div>
          {filteredHistory.length > 1 ? (
            <LineChart data={filteredHistory} height={200} color="#8b5cf6" />
          ) : (
            <div style={{ height:200, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:13, flexDirection:'column', gap:8 }}>
              <TrendingUp size={32} style={{ opacity:0.3 }}/>
              <span>Place your first trade to see the chart</span>
            </div>
          )}
        </div>

        {/* Market Overview */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-sm)' }}>Market Overview</div>
          {INDEX_STOCKS.slice(0, 4).map(s => <IndexRow key={s.instrumentKey} stock={s} />)}
        </div>
      </div>

      {/* Holdings + Positions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
        {/* Holdings */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <span className="section-title"><Package size={15}/> Holdings <span className="count">{holdings.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/holdings')}>View All <ArrowRight size={12}/></button>
          </div>
          {topHoldings.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr>
                  <th>Instrument</th><th className="col-right">LTP</th><th className="col-right">P&L</th>
                </tr></thead>
                <tbody>
                  {topHoldings.map(h => (
                    <tr key={h.id} onClick={() => navigate(`/stock/${encodeURIComponent(h.instrumentKey)}`)}>
                      <td><div style={{ fontWeight:600 }}>{h.tradingsymbol}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Qty: {h.qty}</div></td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(h.ltp)}</td>
                      <td className="col-right" style={{ color: h.pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600, fontFamily:"'Space Grotesk',monospace" }}>
                        {formatCurrency(h.pnl, true)}<br/><span style={{ fontSize:11 }}>{formatPercent(h.pnlPct)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              <Package size={28} style={{ opacity:0.3, marginBottom:8 }}/>
              <div>No holdings yet</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop:10 }} onClick={() => navigate('/market')}>Browse Market</button>
            </div>
          )}
        </div>

        {/* Positions */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
            <span className="section-title"><BarChart2 size={15}/> Positions <span className="count">{positions.length}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/positions')}>View All <ArrowRight size={12}/></button>
          </div>
          {topPositions.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr>
                  <th>Instrument</th><th className="col-right">LTP</th><th className="col-right">P&L</th>
                </tr></thead>
                <tbody>
                  {topPositions.map(p => (
                    <tr key={p.id}>
                      <td><div style={{ fontWeight:600 }}>{p.tradingsymbol}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Qty: {p.qty} · {p.product}</div></td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(p.ltp)}</td>
                      <td className="col-right" style={{ color: p.pnl >= 0 ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600, fontFamily:"'Space Grotesk',monospace" }}>
                        {formatCurrency(p.pnl, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              <BarChart2 size={28} style={{ opacity:0.3, marginBottom:8 }}/>
              <div>No open positions</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
          <span className="section-title"><ShoppingCart size={15}/> Recent Orders</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>View All <ArrowRight size={12}/></button>
        </div>
        {recentOrders.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Instrument</th><th>Type</th><th className="col-right">Price</th><th className="col-right">Qty</th><th>Status</th></tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ color:'var(--text-muted)', fontSize:11 }}>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</td>
                    <td><span style={{ fontWeight:600 }}>{o.tradingsymbol}</span> · {o.side}</td>
                    <td><Badge type={o.orderType}>{o.orderType}</Badge></td>
                    <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(o.price)}</td>
                    <td className="col-right">{o.qty}</td>
                    <td><Badge type={o.status}>{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            <ShoppingCart size={28} style={{ opacity:0.3, marginBottom:8 }}/>
            <div>No orders yet. Go to Market to start trading.</div>
          </div>
        )}
      </div>
    </div>
  );
}
