/* MarketDepth.jsx */
import { useMarket } from '../../context/MarketContext.jsx';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useOrderBook } from '../../hooks/useOrderBook.js';
import { fmtPrice, formatNumber } from '../../utils/formatting.js';

export default function MarketDepth({ instrumentKey }) {
  const {source}=useMarket();
  const depth   = useOrderBook(instrumentKey);
  const [open, setOpen] = useState(true);

  const bids = depth?.bids || [];
  const asks = depth?.asks || [];

  const totalBid = bids.reduce((s, b) => s + b.qty, 0);
  const totalAsk = asks.reduce((s, a) => s + a.qty, 0);

  const bestBid  = bids[0]?.price ?? 0;
  const bestAsk  = asks[0]?.price ?? 0;
  const spread   = bestAsk && bestBid ? (bestAsk - bestBid).toFixed(2) : '-';
  const spreadPct = bestBid ? (((bestAsk - bestBid) / bestBid) * 100).toFixed(3) : '-';

  if(source==='replay')return <div className="glass-card" style={{padding:14,marginTop:8}}><span className="muted">Market depth is unavailable in historical replay.</span></div>;
  if(!depth)return <div className="glass-card" style={{padding:14,marginTop:8}}><span className="muted">No market depth received yet.</span></div>;
  return (
    <div className="glass-card" style={{ marginTop: 8 }}>
      {/* Header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer', borderBottom: open ? '1px solid var(--border-glass)' : 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>Market Depth</span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
               : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {open && (
        <div style={{ padding: '0 0 10px' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 11, color: 'var(--text-secondary)', padding: '6px 14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <span>Qty</span><span style={{ textAlign:'center' }}>Orders</span><span style={{ textAlign:'right' }}>Bid</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <span style={{ textAlign:'left' }}>Ask</span><span style={{ textAlign:'center' }}>Orders</span><span style={{ textAlign:'right' }}>Qty</span>
            </div>
          </div>

          {/* Rows */}
          {Array.from({ length: 5 }).map((_, i) => {
            const bid = bids[i];
            const ask = asks[i];
            const bidPct = totalBid > 0 && bid ? (bid.qty / totalBid) * 100 : 0;
            const askPct = totalAsk > 0 && ask ? (ask.qty / totalAsk) * 100 : 0;

            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 12 }}>
                {/* Bid side */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '3px 14px', alignItems: 'center' }}>
                  <div style={{ position:'absolute', right:0, top:0, bottom:0, width:`${bidPct}%`, background:'var(--price-up-dim)', pointerEvents:'none' }}/>
                  <span style={{ color:'var(--text-secondary)', fontVariantNumeric:'tabular-nums' }}>{bid ? formatNumber(bid.qty) : '-'}</span>
                  <span style={{ color:'var(--text-tertiary)', textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{bid?.orders ?? '-'}</span>
                  <span style={{ color:'var(--price-up)', textAlign:'right', fontFamily:"'JetBrains Mono', monospace", fontVariantNumeric:'tabular-nums', fontWeight:500 }}>{bid ? fmtPrice(bid.price) : '-'}</span>
                </div>
                {/* Ask side */}
                <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'3px 14px', alignItems:'center' }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${askPct}%`, background:'var(--price-down-dim)', pointerEvents:'none' }}/>
                  <span style={{ color:'var(--price-down)', fontFamily:"'JetBrains Mono', monospace", fontVariantNumeric:'tabular-nums', fontWeight:500 }}>{ask ? fmtPrice(ask.price) : '-'}</span>
                  <span style={{ color:'var(--text-tertiary)', textAlign:'center', fontVariantNumeric:'tabular-nums' }}>{ask?.orders ?? '-'}</span>
                  <span style={{ color:'var(--text-secondary)', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{ask ? formatNumber(ask.qty) : '-'}</span>
                </div>
              </div>
            );
          })}

          {/* Totals + spread */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', marginTop:4, padding:'4px 14px', borderTop:'1px solid var(--border-subtle)' }}>
            <div style={{ fontSize:11 }}>
              <span style={{ color:'var(--text-tertiary)' }}>Total: </span>
              <span style={{ color:'var(--price-up)', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{formatNumber(totalBid)}</span>
            </div>
            <div style={{ fontSize:11, textAlign:'right' }}>
              <span style={{ color:'var(--text-tertiary)' }}>Total: </span>
              <span style={{ color:'var(--price-down)', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{formatNumber(totalAsk)}</span>
            </div>
          </div>
          <div style={{ textAlign:'center', fontSize:11, color:'var(--text-secondary)', marginTop:4, fontVariantNumeric:'tabular-nums' }}>
            Spread: {spread} ({spreadPct}%)
          </div>
        </div>
      )}
    </div>
  );
}
