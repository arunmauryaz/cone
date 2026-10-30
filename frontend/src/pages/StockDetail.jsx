/* StockDetail.jsx */
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { useLivePrice } from '../hooks/useLivePrice.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import CandlestickChart from '../components/charts/CandlestickChart.jsx';
import MarketDepth from '../components/trading/MarketDepth.jsx';
import { fmtPrice, formatNumber, formatPercent } from '../utils/formatting.js';
import { useMarket } from '../context/MarketContext.jsx';
import { useMarketInterest } from '../hooks/useMarketInterest.js';

export default function StockDetail() {
  const { instrumentKey } = useParams();
  const decodedKey = decodeURIComponent(instrumentKey);
  const navigate = useNavigate();
  const { openOrderModal, watchlists, toggleWatchlist } = usePortfolio();
  const price = useLivePrice(decodedKey);
  const {instruments}=useMarket();
  useMarketInterest([decodedKey]);
  const stock = instruments.find(s => s.instrumentKey === decodedKey);

  const ltp  = price?.ltp ?? null;
  const chg  = price?.change ?? 0;
  const chgP = price?.changePercent ?? 0;
  const isUp = chgP >= 0;

  const inWatchlist = watchlists?.some(wl => wl.stocks?.includes(decodedKey));

  const statPrice=value=>value==null?'—':fmtPrice(value);
  const fallback=null;
  const stats = [
    { label: 'Open',   value: statPrice(price?.open ?? fallback) },
    { label: 'High',   value: statPrice(price?.high ?? fallback) },
    { label: 'Low',    value: statPrice(price?.low ?? fallback) },
    { label: 'Close',  value: statPrice(price?.close ?? fallback) },
    { label: 'Volume', value: price?.volume==null?'—':formatNumber(price.volume) },
    { label: 'Sector', value: stock?.sector ?? '-' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={16}/></button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, fontWeight: 700 }}>{stock?.tradingsymbol}</h1>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '1px 6px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>{stock?.exchange}</span>
              {stock?.sector && <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '1px 6px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>{stock.sector}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{stock?.name}</div>
          </div>

          {/* Live price */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {ltp==null?'—':fmtPrice(ltp)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: isUp ? 'var(--price-up)' : 'var(--price-down)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
              {isUp ? '▲ +' : '▼ '}{Math.abs(chg).toFixed(2)} ({formatPercent(chgP)})
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn-icon"
              title={inWatchlist ? "Remove from Favorites" : "Add to Favorites"}
              onClick={() => toggleWatchlist(0, decodedKey)}
              style={{
                transition: 'all 150ms ease',
                background: inWatchlist ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface-raised)',
                border: inWatchlist ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
              }}
            >
              <Star
                size={16}
                style={{
                  fill: inWatchlist ? '#3B82F6' : 'none',
                  color: inWatchlist ? '#3B82F6' : 'var(--text-secondary)',
                  transition: 'all 150ms ease',
                }}
              />
            </button>
            <button className="btn btn-buy" disabled={stock?.tradable===false || stock?.segment==='INDICES' || stock?.segment?.endsWith('INDEX')} onClick={() => openOrderModal({ instrumentKey: decodedKey, side: 'BUY' })}>
              Buy
            </button>
            <button className="btn btn-sell" disabled={stock?.tradable===false || stock?.segment==='INDICES' || stock?.segment?.endsWith('INDEX')} onClick={() => openOrderModal({ instrumentKey: decodedKey, side: 'SELL' })}>
              Sell
            </button>
          </div>
        </div>

        {/* OHLCV stats */}
        <div style={{ display: 'flex', gap: 'var(--space-xl)', marginTop: 'var(--space-md)', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 500, fontFamily: s.label === 'Sector' ? "'Inter', sans-serif" : "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Depth */}
      <div className="stock-detail-columns" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 'var(--space-md)' }}>
        <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
          <CandlestickChart instrumentKey={decodedKey} height={400} />
          <MarketDepth instrumentKey={decodedKey} />
        </div>

        {/* Right info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Quick Order</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-buy btn-full" style={{ padding: '10px', fontSize: 12 }} onClick={() => openOrderModal({ instrumentKey: decodedKey, side: 'BUY' })}>
                Buy {stock?.tradingsymbol}
              </button>
              <button className="btn btn-sell btn-full" style={{ padding: '10px', fontSize: 12 }} onClick={() => openOrderModal({ instrumentKey: decodedKey, side: 'SELL' })}>
                Sell {stock?.tradingsymbol}
              </button>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div className="section-title" style={{ marginBottom: 'var(--space-sm)' }}>Instrument Details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Symbol',   stock?.tradingsymbol ?? '-'],
                ['Exchange', stock?.exchange ?? '-'],
                ['Segment',  stock?.segment ?? '-'],
                ['Lot Size', stock?.lotSize ?? 1],
                ['Tick Size', `${stock?.tickSize ?? 0.05}`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                  <span style={{ fontWeight: 500, fontFamily: typeof val === 'number' ? "'JetBrains Mono', monospace" : 'inherit', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
