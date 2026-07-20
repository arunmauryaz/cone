/* OrderModal.jsx — Global order placement panel */
import { useState, useEffect, useCallback } from 'react';
import { X, Minus, Plus, ChevronDown, Info } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useMarket } from '../../context/MarketContext.jsx';
import { useLivePrice } from '../../hooks/useLivePrice.js';
import { calcRequiredMargin, calcBrokerage } from '../../utils/calculations.js';
import { formatCurrency, fmtPrice } from '../../utils/formatting.js';
import { MOCK_STOCKS } from '../../utils/constants.js';

export default function OrderModal() {
  const { orderModal, closeOrderModal, placeOrder, wallet, holdings } = usePortfolio();

  const { visible, instrumentKey, side: defaultSide } = orderModal || {};

  const livePrice = useLivePrice(instrumentKey);
  const stock = MOCK_STOCKS.find(s => s.instrumentKey === instrumentKey);

  const [tab,       setTab]       = useState('regular'); // 'regular' | 'gtt'
  const [side,      setSide]      = useState(defaultSide || 'BUY');
  const [product,   setProduct]   = useState('CNC');
  const [orderType, setOrderType] = useState('MARKET');
  const [qty,       setQty]       = useState(1);
  const [limitPrice, setLimitPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  // GTT fields
  const [gttSide, setGttSide]       = useState('BUY');
  const [gttQty, setGttQty]         = useState(1);
  const [gttTrigger, setGttTrigger] = useState('');
  const [gttLimit, setGttLimit]     = useState('');

  const ltp = livePrice?.ltp ?? stock?.basePrice ?? 0;

  // Sync side when modal opens
  useEffect(() => {
    if (defaultSide) setSide(defaultSide);
    setShowConfirm(false);
    setError('');
    setQty(1);
    setOrderType('MARKET');
    setProduct('CNC');
    setLimitPrice('');
  }, [defaultSide, instrumentKey]);

  const execPrice   = orderType === 'MARKET' ? ltp : (parseFloat(limitPrice) || ltp);
  const margin      = calcRequiredMargin(execPrice, qty, product);
  const brokerage   = calcBrokerage(product, execPrice, qty);
  const available   = wallet?.balance ?? 0;
  const insufficient = side === 'BUY' && margin > available;

  const heldQty = holdings.find(h => h.instrumentKey === instrumentKey)?.qty ?? 0;
  const cantSell = side === 'SELL' && product === 'CNC' && qty > heldQty;

  if (!visible) return null;

  function handleSubmit() {
    setError('');
    if (qty <= 0) return setError('Quantity must be at least 1');
    if (insufficient) return setError('Insufficient CONE Coins');
    if (cantSell)     return setError(`You only hold ${heldQty} shares`);
    setShowConfirm(true);
  }

  function handleConfirm() {
    const result = placeOrder({
      instrumentKey, side, qty: parseInt(qty),
      orderType, product,
      price: parseFloat(limitPrice) || ltp,
    });
    if (result?.ok !== false) {
      setShowConfirm(false);
    }
  }

  function handleGTT() {
    const { addGTT } = usePortfolio();
    // handled via portfolio context
  }

  const buyActive  = side === 'BUY';
  const accentColor = buyActive ? 'var(--color-buy)' : 'var(--color-sell)';

  return (
    <>
      {/* Overlay on mobile */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 199,
          background: 'rgba(0,0,0,0.3)',
          display: visible ? 'block' : 'none',
        }}
        onClick={closeOrderModal}
      />

      {/* Panel */}
      <div className="slide-in-right" style={{
        position: 'fixed', top: 'calc(var(--ticker-height) + var(--topbar-height))',
        right: 0, bottom: 0, width: 'var(--order-panel-width)',
        background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(24px)',
        borderLeft: `2px solid ${accentColor}`,
        zIndex: 200, display: 'flex', flexDirection: 'column',
        boxShadow: `-4px 0 24px rgba(0,0,0,0.6)`,
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-glass)', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>
              {stock?.tradingsymbol || instrumentKey?.split('|')[1] || 'Stock'}
            </div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Space Grotesk',monospace", color: accentColor }}>
              C {fmtPrice(ltp)}
            </div>
          </div>
          <button className="btn-icon" onClick={closeOrderModal}><X size={18}/></button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border-glass)' }}>
          {['regular','gtt'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, padding:'9px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer',
              background: tab===t ? 'rgba(139,92,246,0.1)' : 'transparent',
              color: tab===t ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: tab===t ? '2px solid var(--accent-primary)' : '2px solid transparent',
              textTransform:'uppercase', letterSpacing:'0.05em',
            }}>
              {t === 'regular' ? 'Regular' : 'GTT'}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding: '14px' }}>

          {tab === 'regular' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Product type */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                {['CNC','MIS'].map(p => (
                  <button key={p} onClick={() => setProduct(p)} style={{
                    padding:'7px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer',
                    background: product===p ? 'rgba(139,92,246,0.2)' : 'var(--bg-input)',
                    color: product===p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize:12, fontWeight:600, transition:'all 150ms',
                    outline: product===p ? '1px solid var(--accent-primary)' : 'none',
                  }}>
                    {p === 'CNC' ? 'Delivery (CNC)' : 'Intraday (MIS)'}
                  </button>
                ))}
              </div>
              {product === 'MIS' && (
                <div className="alert alert-info" style={{ fontSize:11 }}>
                  5× leverage. Auto-squares off at 3:20 PM.
                </div>
              )}

              {/* BUY / SELL */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                <button onClick={() => setSide('BUY')} style={{
                  padding:'10px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                  background: side==='BUY' ? 'var(--color-buy)' : 'var(--bg-input)',
                  color: side==='BUY' ? '#fff' : 'var(--text-muted)', transition:'all 150ms',
                }}>BUY</button>
                <button onClick={() => setSide('SELL')} style={{
                  padding:'10px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                  background: side==='SELL' ? 'var(--color-sell)' : 'var(--bg-input)',
                  color: side==='SELL' ? '#fff' : 'var(--text-muted)', transition:'all 150ms',
                }}>SELL</button>
              </div>

              {/* Order type */}
              <div className="input-group">
                <label className="input-label">Order Type</label>
                <select className="select" value={orderType} onChange={e => setOrderType(e.target.value)} style={{ width:'100%' }}>
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="SL">Stop Loss (SL)</option>
                  <option value="SL-M">SL Market (SL-M)</option>
                </select>
              </div>

              {/* Price inputs */}
              {(orderType === 'LIMIT' || orderType === 'SL') && (
                <div className="input-group">
                  <label className="input-label">Limit Price</label>
                  <input className="input" type="number" step="0.05" value={limitPrice}
                    onChange={e => setLimitPrice(e.target.value)}
                    placeholder={fmtPrice(ltp)} />
                </div>
              )}
              {(orderType === 'SL' || orderType === 'SL-M') && (
                <div className="input-group">
                  <label className="input-label">Trigger Price</label>
                  <input className="input" type="number" step="0.05" value={triggerPrice}
                    onChange={e => setTriggerPrice(e.target.value)}
                    placeholder={fmtPrice(ltp)} />
                </div>
              )}

              {/* Quantity stepper */}
              <div className="input-group">
                <label className="input-label">Quantity</label>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setQty(q => Math.max(1, q - 1))}>
                    <Minus size={14}/>
                  </button>
                  <input type="number" value={qty} min="1"
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ border:'none', background:'transparent', color:'var(--text-primary)', textAlign:'center', width:80, fontFamily:"'Space Grotesk',monospace", outline:'none', fontSize:14, fontWeight:600 }}
                  />
                  <button className="stepper-btn" onClick={() => setQty(q => q + 1)}>
                    <Plus size={14}/>
                  </button>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                  Estimated: {formatCurrency(execPrice * qty)}
                </div>
              </div>

              {/* Margin box */}
              <div style={{
                background: insufficient ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${insufficient ? 'var(--color-sell)' : 'var(--border-glass)'}`,
                borderRadius: 'var(--radius-md)', padding: '10px 12px',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:'var(--text-muted)' }}>Required</span>
                  <span style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600, color: insufficient ? 'var(--color-sell)' : 'var(--text-primary)' }}>
                    {formatCurrency(margin)}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                  <span style={{ color:'var(--text-muted)' }}>Available</span>
                  <span style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600, color:'var(--color-buy)' }}>
                    {formatCurrency(available)}
                  </span>
                </div>
                {/* Usage bar */}
                <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                  <div style={{
                    height:'100%', borderRadius:2,
                    width: `${Math.min((margin/Math.max(available,1))*100,100)}%`,
                    background: insufficient ? 'var(--color-sell)' : 'var(--color-buy)',
                    transition: 'width 300ms',
                  }}/>
                </div>
                {brokerage > 0 && (
                  <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)' }}>
                    Brokerage: {formatCurrency(brokerage)}
                  </div>
                )}
              </div>

              {/* Sell validation */}
              {side === 'SELL' && product === 'CNC' && (
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  Holdings: <span style={{ color: heldQty > 0 ? 'var(--color-buy)' : 'var(--color-sell)' }}>{heldQty} shares</span>
                </div>
              )}

              {/* Error */}
              {error && <div className="alert alert-danger" style={{ fontSize:12 }}>{error}</div>}
            </div>
          )}

          {tab === 'gtt' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="alert alert-info" style={{ fontSize:12 }}>
                GTT orders stay active until triggered, regardless of market hours.
              </div>
              <div className="input-group">
                <label className="input-label">Trigger Price</label>
                <input className="input" type="number" value={gttTrigger} onChange={e => setGttTrigger(e.target.value)} placeholder="Enter trigger price" />
              </div>
              <div className="input-group">
                <label className="input-label">Limit Price</label>
                <input className="input" type="number" value={gttLimit} onChange={e => setGttLimit(e.target.value)} placeholder="Enter limit price" />
              </div>
              <div className="input-group">
                <label className="input-label">Quantity</label>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setGttQty(q => Math.max(1,q-1))}><Minus size={14}/></button>
                  <input type="number" value={gttQty} onChange={e => setGttQty(Math.max(1,parseInt(e.target.value)||1))}
                    style={{ border:'none',background:'transparent',color:'var(--text-primary)',textAlign:'center',width:80,fontFamily:"'Space Grotesk',monospace",outline:'none',fontSize:14,fontWeight:600 }}/>
                  <button className="stepper-btn" onClick={() => setGttQty(q => q+1)}><Plus size={14}/></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit footer */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border-glass)' }}>
          {tab === 'regular' ? (
            <button
              className={`btn btn-full ${side==='BUY' ? 'btn-buy' : 'btn-sell'}`}
              style={{ fontSize:14, fontWeight:700, padding:12 }}
              onClick={handleSubmit}
              disabled={insufficient || cantSell || qty <= 0}
            >
              Review {side} Order
            </button>
          ) : (
            <button className="btn btn-primary btn-full" style={{ fontSize:14, fontWeight:700, padding:12 }}>
              Set GTT Order
            </button>
          )}
        </div>

        {/* Confirmation overlay */}
        {showConfirm && (
          <div style={{
            position:'absolute', inset:0, background:'rgba(10,10,20,0.97)',
            display:'flex', flexDirection:'column', justifyContent:'center',
            padding:'var(--space-lg)', gap:'var(--space-md)',
          }} className="fade-in">
            <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", textAlign:'center' }}>
              Confirm Order
            </div>
            <div className="glass-card gradient" style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['Action', `${side} ${qty} × ${stock?.tradingsymbol}`],
                ['Type', orderType],
                ['Price', orderType==='MARKET' ? `Market (~C ${fmtPrice(ltp)})` : `C ${fmtPrice(parseFloat(limitPrice)||ltp)}`],
                ['Product', product],
                ['Total', formatCurrency(execPrice * qty)],
                ['Brokerage', formatCurrency(brokerage)],
              ].map(([label, val]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                  <span style={{ color:'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Edit Order</button>
              <button
                className={`btn ${side==='BUY' ? 'btn-buy' : 'btn-sell'}`}
                onClick={handleConfirm}
              >
                Confirm {side}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
