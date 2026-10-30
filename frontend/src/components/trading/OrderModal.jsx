/* UI ticket only: Rust validates, reserves cash and executes every connected order. */
import { useEffect, useRef, useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext.jsx';
import { useMarket } from '../../context/MarketContext.jsx';
import { useLivePrice } from '../../hooks/useLivePrice.js';
import { calcRequiredMargin, calcBrokerage } from '../../utils/calculations.js';
import { formatCurrency, fmtPrice } from '../../utils/formatting.js';
import './OrderModal.css';
import { useMarketInterest } from '../../hooks/useMarketInterest.js';

const TYPES = [
  ['MARKET', 'Market'],
  ['LIMIT', 'Limit'],
  ['SL', 'Stop-loss limit (SL)'],
  ['SL-M', 'Stop-loss market (SL-M)'],
];

export default function OrderModal() {
  const { orderModal } = usePortfolio();
  return orderModal?.visible ? <OrderTicket key={`${orderModal.instrumentKey}:${orderModal.side}`} {...orderModal} /> : null;
}

function OrderTicket({ instrumentKey, side: initialSide = 'BUY' }) {
  useMarketInterest([instrumentKey]);
  const { closeOrderModal, placeOrder, wallet, holdings, orders } = usePortfolio();
  const { instruments } = useMarket();
  const livePrice = useLivePrice(instrumentKey);
  const stock = instruments.find(s => s.instrumentKey === instrumentKey);
  const ltp = livePrice?.ltp ?? 0;
  const tick = stock?.tickSize || 0.05;
  const lot = stock?.lotSize || 1;
  const seededPrice = ltp > 0 ? (Math.round(ltp / tick) * tick).toFixed(2) : '';
  const [tab, setTab] = useState('quick');
  const [side, setSide] = useState(initialSide);
  const [product, setProduct] = useState('CNC');
  const [orderType, setOrderType] = useState('LIMIT');
  const [qty, setQty] = useState(String(lot));
  const [price, setPrice] = useState(seededPrice);
  const [trigger, setTrigger] = useState('');
  const [review, setReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef(null);
  const quantityInput = useRef(null);
  const sending = useRef(false);
  const closeHandler = useRef(closeOrderModal);
  const close = () => { if (!sending.current) closeOrderModal(); };

  useEffect(() => {
    const previous = document.activeElement;
    quantityInput.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!sending.current) closeHandler.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
      const first = elements[0], last = elements.at(-1);
      if (!elements.includes(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);

  const hasLimit = orderType === 'LIMIT' || orderType === 'SL';
  const hasTrigger = orderType === 'SL' || orderType === 'SL-M';
  const estimatePrice = hasLimit ? Number(price) : (hasTrigger ? Number(trigger) : ltp);
  const brokerage = calcBrokerage(product, estimatePrice, Number(qty));
  const estimate = side === 'SELL' && product === 'CNC' ? 0 : calcRequiredMargin(estimatePrice, Number(qty), product) + brokerage;
  const held = holdings.find(h => h.instrumentKey === instrumentKey)?.qty || 0;
  const reserved = orders.filter(o => o.instrumentKey === instrumentKey && o.side === 'SELL' && o.product === 'CNC' && o.status === 'OPEN').reduce((sum, o) => sum + o.qty, 0);
  const availableShares = Math.max(0, held - reserved);
  const symbol = stock?.tradingsymbol || instrumentKey?.split('|')[1];
  const change = setter => event => { setter(event.target.value); setError(''); };

  function validateMoney(value, label) {
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) return `${label} must be a positive price with up to 2 decimals.`;
    const units = Math.round(Number(value) * 100), tickUnits = Math.round(tick * 100);
    if (!Number.isSafeInteger(units) || units % tickUnits !== 0) return `${label} must follow the ${tick.toFixed(2)} price step.`;
    return '';
  }

  function handleReview(event) {
    event.preventDefault();
    let issue = !/^\d+$/.test(qty) || Number(qty) < lot || Number(qty) > 1000000 || Number(qty) % lot !== 0 ? `Quantity must be a whole multiple of ${lot}, up to 1,000,000.` : '';
    if (!issue && hasLimit) issue = validateMoney(price, 'Price');
    if (!issue && hasTrigger) issue = validateMoney(trigger, 'Trigger price');
    if (!issue && orderType === 'SL' && (side === 'BUY' ? Number(price) < Number(trigger) : Number(price) > Number(trigger))) issue = side === 'BUY' ? 'For a buy stop-limit, price must be at or above the trigger.' : 'For a sell stop-limit, price must be at or below the trigger.';
    if (!issue && side === 'SELL' && product === 'CNC' && Number(qty) > availableShares) issue = `You have ${availableShares} unreserved shares to sell. Use Intraday for a short sale.`;
    if (issue) { setError(issue); return; }
    setError('');
    setReview({ instrumentKey, side, product, orderType, qty: Number(qty), ...(hasLimit ? { price } : {}), ...(hasTrigger ? { triggerPrice: trigger } : {}) });
  }

  async function confirm() {
    if (sending.current) return;
    sending.current = true; setSubmitting(true); setError('');
    try {
      const result = await placeOrder(review);
      if (result?.ok === false) { setError(result.error || 'Could not place the order.'); return; }
      closeOrderModal();
    } catch (failure) { setError(failure.message || 'Could not place the order. Retry the same order after reconnecting.'); }
    finally { sending.current = false; setSubmitting(false); }
  }

  return <div className="order-ticket-backdrop" onClick={close}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="ticket-title" className={`order-ticket ${side === 'BUY' ? 'is-buy' : 'is-sell'}`} onClick={e => e.stopPropagation()}>
      <header className="ticket-header">
        <div><h2 id="ticket-title">{symbol} <small>{stock?.exchange || 'NSE'}</small></h2><div className="ticket-quote">C {fmtPrice(ltp)}</div></div>
        <button className="btn-icon" aria-label="Close order" disabled={submitting} onClick={close}><X size={18}/></button>
      </header>
      {!review ? <>
        <nav className="ticket-tabs" aria-label="Order mode">{['quick', 'regular'].map(mode => <button key={mode} aria-pressed={tab === mode} onClick={() => { setTab(mode); setError(''); if (mode === 'quick' && hasTrigger) setOrderType('LIMIT'); }}>{mode === 'quick' ? 'Quick' : 'Regular'}</button>)}</nav>
        <form className="ticket-form" onSubmit={handleReview} noValidate>
          <div className="ticket-body">
            <div className="ticket-side">{['BUY', 'SELL'].map(value => <button type="button" key={value} aria-pressed={side === value} onClick={() => { setSide(value); setError(''); }}>{value === 'BUY' ? 'Buy' : 'Sell'}</button>)}</div>
            {tab === 'regular' && <fieldset className="ticket-products"><legend>Product</legend>{[['MIS','Intraday'], ['CNC','Long-term']].map(([value,label]) => <label key={value}><input type="radio" name="product" checked={product === value} onChange={() => setProduct(value)}/>{label} <small>{value}</small></label>)}</fieldset>}
            <div className="ticket-fields">
              <label>Quantity<div className="ticket-stepper"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(String(Math.max(lot, (Number(qty) || lot) - lot)))}><Minus size={14}/></button><input ref={quantityInput} aria-label="Quantity" type="number" min={lot} step={lot} value={qty} onChange={change(setQty)}/><button type="button" aria-label="Increase quantity" onClick={() => setQty(String((Number(qty) || 0) + lot))}><Plus size={14}/></button></div></label>
              <label htmlFor="ticket-price">Price (C)<input id="ticket-price" className="input" type="number" min={tick} step={tick} disabled={!hasLimit} value={hasLimit ? price : ''} placeholder="Market price" onChange={change(setPrice)}/></label>
            </div>
            {tab === 'quick' ? <div className="ticket-quick-options"><label><input type="checkbox" checked={product === 'MIS'} onChange={e => setProduct(e.target.checked ? 'MIS' : 'CNC')}/>Intraday</label><label><input type="checkbox" checked={orderType === 'MARKET'} onChange={e => setOrderType(e.target.checked ? 'MARKET' : 'LIMIT')}/>Market price</label></div> : <>
              <fieldset className="ticket-types"><legend>Order type</legend>{TYPES.map(([value,label]) => <label key={value}><input type="radio" name="order-type" checked={orderType === value} onChange={() => { setOrderType(value); setError(''); }}/>{label}</label>)}</fieldset>
              {hasTrigger && <label htmlFor="ticket-trigger">Trigger price (C)<input id="ticket-trigger" className="input" type="number" min={tick} step={tick} placeholder="Trigger price" value={trigger} onChange={change(setTrigger)}/></label>}
            </>}
            {side === 'SELL' && product === 'CNC' && <p className="ticket-help">Available to sell: <strong>{availableShares} shares</strong></p>}
            {error && <p role="alert" className="ticket-error">{error}</p>}
          </div>
          <footer className="ticket-footer">
            <div className="ticket-funds"><div><span>Est. required</span><strong>{formatCurrency(Number.isFinite(estimate) ? estimate : 0)}</strong></div><div><span>Available</span><strong>{formatCurrency(wallet?.balance || 0)}</strong></div></div>
            <div className="ticket-actions"><button type="button" className="btn btn-ghost" onClick={close}>Cancel</button><button className={`btn ${side === 'BUY' ? 'btn-buy' : 'btn-sell'}`} type="submit">Review {side === 'BUY' ? 'buy' : 'sell'}</button></div>
          </footer>
        </form>
      </> : <div className="ticket-review">
        <h3>Review {review.side === 'BUY' ? 'buy' : 'sell'}</h3>
        <dl>{[
          ['Stock', symbol], ['Quantity', review.qty], ['Product', review.product === 'CNC' ? 'Long-term (CNC)' : 'Intraday (MIS)'],
          ['Order type', TYPES.find(([value]) => value === review.orderType)[1]],
          ['Price', review.price ? `C ${review.price}` : 'Market price at execution'],
          ...(review.triggerPrice ? [['Trigger price', `C ${review.triggerPrice}`]] : []),
        ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {error && <p role="alert" className="ticket-error">{error}</p>}
        <div className="ticket-actions"><button className="btn btn-ghost" disabled={submitting} onClick={() => { setReview(null); setError(''); }}>Edit order</button><button className={`btn ${review.side === 'BUY' ? 'btn-buy' : 'btn-sell'}`} disabled={submitting} onClick={confirm}>{submitting ? 'Submitting…' : `Confirm ${review.side === 'BUY' ? 'buy' : 'sell'}`}</button></div>
      </div>}
    </section>
  </div>;
}
