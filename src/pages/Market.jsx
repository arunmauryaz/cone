/* Market.jsx */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, BarChart2, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { useMarket } from '../context/MarketContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useLivePrice } from '../hooks/useLivePrice.js';
import { fmtPrice, formatNumber } from '../utils/formatting.js';
import { EQUITY_STOCKS, INDEX_STOCKS, SECTOR_COLORS } from '../utils/constants.js';
import Badge from '../components/common/Badge.jsx';

/* ---- Watchlist stock row ---- */
function WatchlistRow({ instrumentKey, onRemove, onBuy, onSell, onChart }) {
  const price = useLivePrice(instrumentKey);
  const stock = EQUITY_STOCKS.find(s => s.instrumentKey === instrumentKey) || INDEX_STOCKS.find(s => s.instrumentKey === instrumentKey);
  const [hovered, setHovered] = useState(false);
  const prevLtp = useRef(null);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (price?.ltp && prevLtp.current !== null && prevLtp.current !== price.ltp) {
      setFlashClass(price.ltp > prevLtp.current ? 'flash-up' : 'flash-down');
      setTimeout(() => setFlashClass(''), 650);
    }
    prevLtp.current = price?.ltp ?? null;
  }, [price?.ltp]);

  if (!stock) return null;
  const ltp = price?.ltp ?? stock.basePrice;
  const chg = price?.changePercent ?? 0;
  const isUp = chg >= 0;

  return (
    <div
      className={flashClass}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'flex', alignItems:'center', padding:'8px 12px', cursor:'pointer',
        borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 150ms',
        background: hovered ? 'var(--bg-card-hover)' : 'transparent', borderRadius: hovered ? 'var(--radius-sm)' : 0,
      }}
    >
      <div style={{ flex:1, minWidth:0 }} onClick={onChart}>
        <div style={{ fontSize:13, fontWeight:600 }}>{stock.tradingsymbol}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{stock.exchange} · {stock.sector}</div>
      </div>
      {hovered ? (
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={onBuy}  style={{ padding:'3px 10px', background:'var(--color-buy)',  color:'#fff', border:'none', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer' }}>B</button>
          <button onClick={onSell} style={{ padding:'3px 10px', background:'var(--color-sell)', color:'#fff', border:'none', borderRadius:4, fontSize:11, fontWeight:700, cursor:'pointer' }}>S</button>
          <button onClick={onChart} style={{ padding:'3px 6px', background:'rgba(255,255,255,0.08)', color:'var(--text-secondary)', border:'none', borderRadius:4, fontSize:11, cursor:'pointer' }}><BarChart2 size={12}/></button>
          {onRemove && <button onClick={onRemove} style={{ padding:'3px 6px', background:'rgba(239,68,68,0.12)', color:'var(--color-sell)', border:'none', borderRadius:4, fontSize:11, cursor:'pointer' }}><X size={12}/></button>}
        </div>
      ) : (
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, fontSize:13 }}>C {fmtPrice(ltp)}</div>
          <div style={{ fontSize:11, color: isUp ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
            {isUp ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Stock mover card ---- */
function MoverCard({ stock, prices }) {
  const navigate = useNavigate();
  const price = prices.get(stock.instrumentKey);
  const ltp   = price?.ltp ?? stock.basePrice;
  const chg   = price?.changePercent ?? 0;
  const isUp  = chg >= 0;
  return (
    <div className="glass-card hoverable" onClick={() => navigate(`/stock/${encodeURIComponent(stock.instrumentKey)}`)} style={{ padding:'12px 14px', minWidth:140, cursor:'pointer', flexShrink:0 }}>
      <div style={{ width:32, height:32, borderRadius:8, background: SECTOR_COLORS[stock.sector] + '33', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, fontSize:11, fontWeight:700, color: SECTOR_COLORS[stock.sector] }}>
        {stock.tradingsymbol.slice(0,3)}
      </div>
      <div style={{ fontSize:12, fontWeight:700 }}>{stock.tradingsymbol}</div>
      <div style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700, fontSize:14, marginTop:4 }}>C {fmtPrice(ltp)}</div>
      <div style={{ fontSize:12, color: isUp ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
        {isUp ? '+' : ''}{chg.toFixed(2)}%
      </div>
    </div>
  );
}

export default function Market() {
  const { prices, searchInstruments, getTopGainers, getTopLosers, getMostActive } = useMarket();
  const { watchlists, addToWatchlist, removeFromWatchlist, openOrderModal } = usePortfolio();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [wlIdx, setWlIdx] = useState(0);

  const watchlist = watchlists?.[wlIdx] || { name:'My List 1', stocks:[] };
  const gainers   = getTopGainers(8);
  const losers    = getTopLosers(8);
  const active    = getMostActive(15);

  function handleSearch(q) {
    setQuery(q);
    setSearchResults(q.length >= 1 ? searchInstruments(q) : []);
  }

  function addStock(instrumentKey) {
    addToWatchlist(wlIdx, instrumentKey);
    setQuery('');
    setSearchResults([]);
  }

  return (
    <div style={{ display:'flex', gap:'var(--space-md)', height:'calc(100vh - var(--ticker-height) - var(--topbar-height) - var(--space-lg)*2)', overflow:'hidden' }}>
      {/* Left: Watchlist panel */}
      <div className="glass-card" style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border-glass)', display:'flex', alignItems:'center', gap:8 }}>
          <select className="select" value={wlIdx} onChange={e => setWlIdx(Number(e.target.value))} style={{ flex:1, fontSize:13, fontWeight:600 }}>
            {(watchlists || []).map((wl, i) => <option key={i} value={i}>{wl.name}</option>)}
          </select>
        </div>

        {/* Search */}
        <div style={{ padding:'8px 10px', position:'relative', borderBottom:'1px solid var(--border-glass)' }}>
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
            <input className="input" value={query} onChange={e => handleSearch(e.target.value)}
              placeholder="Search & add stocks..." style={{ paddingLeft:28, fontSize:12 }} />
          </div>
          {searchResults.length > 0 && (
            <div className="glass-card" style={{ position:'absolute', left:10, right:10, top:'100%', zIndex:50, maxHeight:240, overflowY:'auto', marginTop:4 }}>
              {searchResults.map(s => (
                <div key={s.instrumentKey} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  onClick={() => addStock(s.instrumentKey)}>
                  <div><div style={{ fontSize:12, fontWeight:600 }}>{s.tradingsymbol}</div><div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.name}</div></div>
                  <Plus size={14} style={{ color:'var(--accent-primary)' }}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist items */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {watchlist.stocks.length > 0 ? watchlist.stocks.map(key => (
            <WatchlistRow
              key={key}
              instrumentKey={key}
              onRemove={() => removeFromWatchlist(wlIdx, key)}
              onBuy={() => openOrderModal({ instrumentKey: key, side:'BUY' })}
              onSell={() => openOrderModal({ instrumentKey: key, side:'SELL' })}
              onChart={() => navigate(`/stock/${encodeURIComponent(key)}`)}
            />
          )) : (
            <div style={{ padding:24, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              Search and add stocks above
            </div>
          )}

          {/* Pinned indices */}
          <div style={{ padding:'6px 12px', fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:8 }}>Indices</div>
          {INDEX_STOCKS.slice(0,4).map(s => (
            <WatchlistRow key={s.instrumentKey} instrumentKey={s.instrumentKey}
              onBuy={() => {}} onSell={() => {}} onChart={() => navigate('/market')} />
          ))}
        </div>
      </div>

      {/* Right: Market Explorer */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
        {/* Top Gainers */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'var(--space-md)' }}>
            <TrendingUp size={16} style={{ color:'var(--color-buy)' }}/>
            <span className="section-title">Top Gainers</span>
          </div>
          <div style={{ display:'flex', gap:'var(--space-sm)', overflowX:'auto', paddingBottom:4 }}>
            {gainers.map(s => <MoverCard key={s.instrumentKey} stock={s} prices={prices}/>)}
          </div>
        </div>

        {/* Top Losers */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'var(--space-md)' }}>
            <TrendingDown size={16} style={{ color:'var(--color-sell)' }}/>
            <span className="section-title">Top Losers</span>
          </div>
          <div style={{ display:'flex', gap:'var(--space-sm)', overflowX:'auto', paddingBottom:4 }}>
            {losers.map(s => <MoverCard key={s.instrumentKey} stock={s} prices={prices}/>)}
          </div>
        </div>

        {/* Most Active */}
        <div className="glass-card" style={{ padding:'var(--space-md)' }}>
          <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Most Active</div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>#</th><th>Instrument</th><th className="col-right">LTP</th><th className="col-right">Volume</th><th className="col-right">Change%</th><th>Action</th></tr></thead>
              <tbody>
                {active.map((s, i) => {
                  const chg = s.changePercent ?? 0;
                  return (
                    <tr key={s.instrumentKey} onClick={() => navigate(`/stock/${encodeURIComponent(s.instrumentKey)}`)}>
                      <td style={{ color:'var(--text-muted)' }}>{i+1}</td>
                      <td><div style={{ fontWeight:600 }}>{s.tradingsymbol}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.sector}</div></td>
                      <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:600 }}>C {fmtPrice(s.ltp)}</td>
                      <td className="col-right" style={{ color:'var(--text-secondary)' }}>{formatNumber(s.volume)}</td>
                      <td className="col-right" style={{ color: chg >= 0 ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
                        {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openOrderModal({ instrumentKey: s.instrumentKey, side:'BUY' })} style={{ padding:'3px 8px', background:'var(--color-buy-dim)',  color:'var(--color-buy)',  border:'1px solid rgba(16,185,129,0.3)', borderRadius:4, fontSize:11, cursor:'pointer', fontWeight:700 }}>B</button>
                          <button onClick={() => openOrderModal({ instrumentKey: s.instrumentKey, side:'SELL' })} style={{ padding:'3px 8px', background:'var(--color-sell-dim)', color:'var(--color-sell)', border:'1px solid rgba(239,68,68,0.3)',  borderRadius:4, fontSize:11, cursor:'pointer', fontWeight:700 }}>S</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
