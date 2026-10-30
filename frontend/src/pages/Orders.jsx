/* Orders.jsx */
import { useState } from 'react';
import { Download, Plus, Trash2, Edit2, X, Bell, RefreshCw } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useLivePrice } from '../hooks/useLivePrice.js';
import { fmtPrice, formatCurrency, formatDateTime } from '../utils/formatting.js';
import Badge from '../components/common/Badge.jsx';

const TABS = ['Orders','GTT','SIP','Alerts'];

/* SIP form */
function SIPForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({ instrumentKey:'NSE_EQ|TCS', qty:1, frequency:'monthly', startDate:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div className="glass-card" style={{ padding:'var(--space-md)', marginBottom:'var(--space-md)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
        <span className="section-title">Create SIP</span>
        <button className="btn-icon" onClick={onClose}><X size={16}/></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="input-group">
          <label className="input-label">Symbol</label>
          <input className="input" value={form.instrumentKey} onChange={e => set('instrumentKey', e.target.value)} placeholder="NSE_EQ|TCS"/>
        </div>
        <div className="input-group">
          <label className="input-label">Quantity</label>
          <input className="input" type="number" min="1" value={form.qty} onChange={e => set('qty', parseInt(e.target.value)||1)}/>
        </div>
        <div className="input-group">
          <label className="input-label">Frequency</label>
          <select className="select" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Start Date</label>
          <input className="input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}/>
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => { onSubmit(form); onClose(); }}>Create SIP</button>
    </div>
  );
}

/* Alert form */
function AlertForm({ onSubmit, onClose }) {
  const [form, setForm] = useState({ instrumentKey:'NSE_EQ|TCS', symbol:'TCS', condition:'above', target:'' });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return (
    <div className="glass-card" style={{ padding:'var(--space-md)', marginBottom:'var(--space-md)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
        <span className="section-title">Create Alert</span>
        <button className="btn-icon" onClick={onClose}><X size={16}/></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="input-group">
          <label className="input-label">Symbol</label>
          <input className="input" value={form.symbol} onChange={e => setForm(f=>({...f,symbol:e.target.value,instrumentKey:`NSE_EQ|${e.target.value.toUpperCase()}`}))} placeholder="TCS"/>
        </div>
        <div className="input-group">
          <label className="input-label">Condition</label>
          <select className="select" value={form.condition} onChange={e => set('condition', e.target.value)}>
            <option value="above">Price Above</option>
            <option value="below">Price Below</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Target Price (C)</label>
          <input className="input" type="number" value={form.target} onChange={e => set('target', parseFloat(e.target.value)||'')} placeholder="3900"/>
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => { onSubmit(form); onClose(); }}>Set Alert</button>
    </div>
  );
}

function OrderRow({ order, onCancel }) {
  const price = useLivePrice(order.instrumentKey);
  const ltp   = price?.ltp ?? order.price;
  return (
    <tr>
      <td style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(order.createdAt)}</td>
      <td><Badge type={order.side}>{order.side}</Badge></td>
      <td style={{ fontWeight: 600 }}>{order.tradingsymbol}</td>
      <td><Badge type={order.product}>{order.product}</Badge></td>
      <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>{order.qty}</td>
      <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtPrice(ltp)}</td>
      <td className="col-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtPrice(order.price)}</td>
      <td><Badge type={order.status}>{order.status}</Badge></td>
      {order.status === 'OPEN' && (
        <td><button className="btn-icon" onClick={() => onCancel(order.id)} title="Cancel"><X size={14}/></button></td>
      )}
      {order.status !== 'OPEN' && <td className="col-right" style={{ color: order.realizedPnL >= 0 ? 'var(--price-up)' : 'var(--price-down)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{order.realizedPnL != null ? formatCurrency(order.realizedPnL, true) : '-'}</td>}
    </tr>
  );
}

export default function Orders() {
  const { orders, gttOrders, sips, alerts, cancelOrder, removeGTT, addSIP, addAlert, removeAlert, pauseSIP, resumeSIP, removeSIP } = usePortfolio();
  const [tab, setTab]       = useState('Orders');
  const [sipForm, setSipForm]   = useState(false);
  const [alertForm, setAlertForm] = useState(false);

  const openOrders    = orders.filter(o => o.status === 'OPEN');
  const executedOrders = orders.filter(o => o.status !== 'OPEN');

  function downloadCSV() {
    const rows = [['Time','Side','Symbol','Product','Qty','Price','Status','P&L'],
      ...orders.map(o => [o.createdAt, o.side, o.tradingsymbol, o.product, o.qty, o.price, o.status, o.realizedPnL ?? ''])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'cone_orders.csv';
    a.click();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Tabs */}
      <div className="glass-card" style={{ padding:'0 var(--space-md)' }}>
        <div className="tab-bar" style={{ marginBottom:0 }}>
          {TABS.map(t => (
            <button key={t} className={`tab-item${tab===t?' active':''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* Orders tab */}
      {tab === 'Orders' && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={downloadCSV}><Download size={14}/> Export CSV</button>
          </div>

          {openOrders.length > 0 && (
            <div className="glass-card" style={{ padding:'var(--space-md)' }}>
              <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Open Orders <span className="count">{openOrders.length}</span></div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Type</th><th>Instrument</th><th>Product</th><th className="col-right">Qty</th><th className="col-right">LTP</th><th className="col-right">Price</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{openOrders.map(o => <OrderRow key={o.id} order={o} onCancel={cancelOrder}/>)}</tbody>
                </table>
              </div>
            </div>
          )}

          <div className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Order History <span className="count">{executedOrders.length}</span></div>
            {executedOrders.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Type</th><th>Instrument</th><th>Product</th><th className="col-right">Qty</th><th className="col-right">LTP</th><th className="col-right">Price</th><th>Status</th><th>P&L</th></tr></thead>
                  <tbody>{executedOrders.map(o => <OrderRow key={o.id} order={o} onCancel={cancelOrder}/>)}</tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No executed orders yet</div>
            )}
          </div>
        </>
      )}

      {/* GTT tab */}
      {tab === 'GTT' && (
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>GTT Orders <span className="count">{gttOrders.length}</span></div>
          {gttOrders.length > 0 ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Instrument</th><th>Side</th><th className="col-right">Trigger</th><th className="col-right">Limit</th><th className="col-right">Qty</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {gttOrders.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight:600 }}>{g.tradingsymbol || g.instrumentKey?.split('|')[1]}</td>
                      <td><Badge type={g.side}>{g.side}</Badge></td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(g.triggerPrice)}</td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace" }}>C {fmtPrice(g.limitPrice)}</td>
                      <td className="col-right">{g.qty}</td>
                      <td><Badge type={g.status}>{g.status}</Badge></td>
                      <td><button className="btn-icon" onClick={() => removeGTT(g.id)}><X size={14}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No GTT orders set</div>}
        </div>
      )}

      {/* SIP tab */}
      {tab === 'SIP' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          {sipForm && <SIPForm onSubmit={addSIP} onClose={() => setSipForm(false)}/>}
          <div className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
              <span className="section-title">Active SIPs <span className="count">{sips.length}</span></span>
              <button className="btn btn-primary btn-sm" onClick={() => setSipForm(true)}><Plus size={14}/> Create SIP</button>
            </div>
            {sips.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Instrument</th><th className="col-right">Qty</th><th>Frequency</th><th>Next Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {sips.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight:600 }}>{s.instrumentKey?.split('|')[1]}</td>
                        <td className="col-right">{s.qty}</td>
                        <td style={{ textTransform:'capitalize' }}>{s.frequency}</td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{s.nextExecutionDate ? new Date(s.nextExecutionDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td><Badge type={s.active ? 'ACTIVE' : 'CANCELLED'}>{s.active ? 'Active' : 'Paused'}</Badge></td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn-icon" title={s.active ? 'Pause' : 'Resume'} onClick={() => s.active ? pauseSIP(s.id) : resumeSIP(s.id)}><RefreshCw size={13}/></button>
                            <button className="btn-icon" onClick={() => removeSIP(s.id)}><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No SIPs set up</div>}
          </div>
        </div>
      )}

      {/* Alerts tab */}
      {tab === 'Alerts' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          {alertForm && <AlertForm onSubmit={addAlert} onClose={() => setAlertForm(false)}/>}
          <div className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--space-md)' }}>
              <span className="section-title">Price Alerts <span className="count">{alerts.length}</span></span>
              <button className="btn btn-primary btn-sm" onClick={() => setAlertForm(true)}><Plus size={14}/> Set Alert</button>
            </div>
            {alerts.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Symbol</th><th>Condition</th><th className="col-right">Target</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {alerts.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight:600 }}>{a.symbol || a.instrumentKey?.split('|')[1]}</td>
                        <td style={{ color:'var(--text-secondary)', textTransform:'capitalize' }}>Price {a.condition}</td>
                        <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600 }}>C {fmtPrice(a.target)}</td>
                        <td><Badge type={a.active ? 'ACTIVE' : 'TRIGGERED'}>{a.active ? 'Active' : 'Triggered'}</Badge></td>
                        <td><button className="btn-icon" onClick={() => removeAlert(a.id)}><X size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding:'24px 0', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No alerts set</div>}
          </div>
        </div>
      )}
    </div>
  );
}
