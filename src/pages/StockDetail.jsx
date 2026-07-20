/* StockDetail.jsx */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Bell } from 'lucide-react';
import { useLivePrice } from '../hooks/useLivePrice.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import CandlestickChart from '../components/charts/CandlestickChart.jsx';
import MarketDepth from '../components/trading/MarketDepth.jsx';
import { fmtPrice, formatNumber, formatPercent } from '../utils/formatting.js';
import { MOCK_STOCKS } from '../utils/constants.js';

export default function StockDetail() {
  const { instrumentKey } = useParams();
  const decodedKey = decodeURIComponent(instrumentKey);
  const navigate = useNavigate();
  const { openOrderModal, watchlists, addToWatchlist } = usePortfolio();
  const price = useLivePrice(decodedKey);
  const stock = MOCK_STOCKS.find(s => s.instrumentKey === decodedKey);

  const ltp  = price?.ltp  ?? stock?.basePrice ?? 0;
  const chg  = price?.change ?? 0;
  const chgP = price?.changePercent ?? 0;
  const isUp = chgP >= 0;

  const inWatchlist = watchlists?.some(wl => wl.stocks.includes(decodedKey));

  const stats = [
    { label:'Open',   value: fmtPrice(price?.open ?? stock?.basePrice ?? 0) },
    { label:'High',   value: fmtPrice(price?.high ?? stock?.basePrice ?? 0) },
    { label:'Low',    value: fmtPrice(price?.low  ?? stock?.basePrice ?? 0) },
    { label:'Close',  value: fmtPrice(price?.close ?? stock?.basePrice ?? 0) },
    { label:'Volume', value: formatNumber(price?.volume ?? 0) },
    { label:'Sector', value: stock?.sector ?? '-' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', flexWrap:'wrap' }}>
          <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={18}/></button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700 }}>{stock?.tradingsymbol}</h1>
              <span style={{ fontSize:12, color:'var(--text-muted)', padding:'2px 8px', background:'rgba(255,255,255,0.06)', borderRadius:'var(--radius-full)' }}>{stock?.exchange}</span>
              {stock?.sector && <span style={{ fontSize:12, color:'var(--text-muted)', padding:'2px 8px', background:'rgba(255,255,255,0.06)', borderRadius:'var(--radius-full)' }}>{stock.sector}</span>}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{stock?.name}</div>
          </div>

          {/* Live price */}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:28, fontWeight:800, lineHeight:1 }}>
              C {fmtPrice(ltp)}
            </div>
            <div style={{ fontSize:13, fontWeight:600, color: isUp ? 'var(--color-buy)' : 'var(--color-sell)', marginTop:2 }}>
              {isUp ? '▲' : '▼'} C {Math.abs(chg).toFixed(2)} ({formatPercent(chgP)})
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-icon" title="Add to Watchlist" onClick={() => addToWatchlist(0, decodedKey)}>
              <Star size={18} style={{ fill: inWatchlist ? 'currentColor' : 'none', color: inWatchlist ? 'var(--color-neutral)' : 'var(--text-secondary)' }}/>
            </button>
            <button className="btn btn-buy" onClick={() => openOrderModal({ instrumentKey: decodedKey, side:'BUY' })}>
              Buy
            </button>
            <button className="btn btn-sell" onClick={() => openOrderModal({ instrumentKey: decodedKey, side:'SELL' })}>
              Sell
            </button>
          </div>
        </div>

        {/* OHLCV stats */}
        <div style={{ display:'flex', gap:'var(--space-lg)', marginTop:'var(--space-md)', flexWrap:'wrap' }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</div>
              <div style={{ fontSize:13, fontWeight:600, fontFamily:s.label==='Volume'?'inherit':"'Space Grotesk',monospace", marginTop:2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Depth */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:'var(--space-md)' }}>
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <CandlestickChart instrumentKey={decodedKey} height={420} />
          <MarketDepth instrumentKey={decodedKey} />
        </div>

        {/* Right info panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          <div className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Quick Order</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <button className="btn btn-buy btn-full" style={{ padding:12, fontSize:14 }} onClick={() => openOrderModal({ instrumentKey: decodedKey, side:'BUY' })}>
                Buy {stock?.tradingsymbol}
              </button>
              <button className="btn btn-sell btn-full" style={{ padding:12, fontSize:14 }} onClick={() => openOrderModal({ instrumentKey: decodedKey, side:'SELL' })}>
                Sell {stock?.tradingsymbol}
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ padding:'var(--space-md)' }}>
            <div className="section-title" style={{ marginBottom:'var(--space-sm)' }}>Stock Info</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['Symbol',   stock?.tradingsymbol ?? '-'],
                ['Exchange', stock?.exchange ?? '-'],
                ['Segment',  stock?.segment ?? '-'],
                ['Lot Size', stock?.lotSize ?? 1],
                ['Tick',     `C ${stock?.tickSize ?? 0.05}`],
              ].map(([label, val]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span style={{ color:'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
