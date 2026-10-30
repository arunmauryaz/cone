import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import Badge from '../components/common/Badge.jsx';
import { formatCurrency, fmtPrice } from '../utils/formatting.js';

const money = value => value == null ? '—' : formatCurrency(value);
export default function Dashboard() {
  const { wallet, holdings, positions, orders, history = [], totalPortfolioValue, todayPnL, returnPnL } = usePortfolio();
  const [period, setPeriod] = useState('1M');
  const [tab, setTab] = useState('Orders');
  const points = useMemo(() => {
    const cutoff = Date.now() - ({ '1W': 7, '1M': 30 }[period] || Infinity) * 86400000;
    return [...new Map(history.filter(h => h.timestamp >= cutoff && Number.isFinite(h.totalValue)).map(h => [Math.floor(h.timestamp / 1000), { time: Math.floor(h.timestamp / 1000), value: h.totalValue }])).values()].sort((a,b) => a.time - b.time);
  }, [history, period]);
  const daily = todayPnL?.total ?? null;
  const rows = tab === 'Orders' ? orders.slice(0, 6) : tab === 'Holdings' ? holdings.slice(0, 6) : positions.slice(0, 6);
  return <div className="dashboard">
    <div className="page-heading"><div><h1>Overview</h1><span className="muted">Paper trading account</span></div><Link to="/market" className="btn btn-primary">Explore market</Link></div>
    <section className="account-metrics" aria-label="Account summary">
      {[
        ['Portfolio value', totalPortfolioValue], ['Available cash', wallet?.balance],
        ['Today’s P&L', daily], ['Total P&L', returnPnL],
      ].map(([label,value],i) => <div key={label}><span>{label}</span><strong className={i >= 2 && value != null ? value >= 0 ? 'text-up' : 'text-down' : ''}>{money(value)}</strong>{i === 1 && <Link to="/funds">Manage funds</Link>}</div>)}
    </section>
    <section className="overview-chart" aria-label="Portfolio history">
      <div className="section-heading"><h2>Portfolio value</h2><div className="segmented" aria-label="Chart period">{['1W','1M','ALL'].map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'ALL' ? 'All' : value}</button>)}</div></div>
      {points.length > 1 ? <LineChart data={points} height={260}/> : <div className="empty-chart"><span>Your portfolio history will appear here.</span><Link to="/market">Find your first stock</Link></div>}
    </section>
    <section className="overview-activity">
      <div className="section-heading"><div className="plain-tabs" aria-label="Account activity">{[['Orders',orders.length],['Holdings',holdings.length],['Positions',positions.length]].map(([value,count]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value} <span>{count}</span></button>)}</div><Link to={`/${tab.toLowerCase()}`}>View all</Link></div>
      {rows.length ? <div className="table-wrapper"><table className="data-table"><thead><tr><th>Stock</th><th>{tab === 'Orders' ? 'Side' : 'Product'}</th><th className="col-right">Quantity</th><th className="col-right">{tab === 'Orders' ? 'Price' : 'Average price'}</th>{tab === 'Orders' && <th className="col-right">Status</th>}</tr></thead><tbody>{rows.map(row => <tr key={row.id || row.instrumentKey}><td><Link className="stock-link" to={`/stock/${encodeURIComponent(row.instrumentKey)}`}>{row.tradingsymbol || row.instrumentKey?.split('|')[1]}</Link></td><td>{tab === 'Orders' ? <span className={row.side === 'BUY' ? 'text-up' : 'text-down'}>{row.side === 'BUY' ? 'Buy' : 'Sell'}</span> : row.product === 'MIS' || tab === 'Positions' ? 'Intraday' : 'Long-term'}</td><td className="col-right">{row.qty}</td><td className="col-right">{(tab === 'Orders' ? row.price : row.avgCost) == null ? '—' : fmtPrice(tab === 'Orders' ? row.price : row.avgCost)}</td>{tab === 'Orders' && <td className="col-right"><Badge type={row.status}>{row.status}</Badge></td>}</tr>)}</tbody></table></div> : <div className="empty-section">{tab === 'Orders' ? 'No orders yet.' : tab === 'Holdings' ? 'No holdings yet.' : 'No open positions.'}</div>}
    </section>
  </div>;
}
