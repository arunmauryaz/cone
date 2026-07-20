/* MarketTicker.jsx */
import { useMemo } from 'react';
import { useMarket } from '../../context/MarketContext.jsx';
import { fmtPrice, formatPercent } from '../../utils/formatting.js';
import { INDEX_STOCKS, EQUITY_STOCKS } from '../../utils/constants.js';

const TICKER_INDICES = [
  'NSE_INDEX|NIFTY50',
  'NSE_INDEX|SENSEX',
  'NSE_INDEX|BANKNIFTY',
  'NSE_INDEX|INDIAVIX',
];

const TOP_STOCKS = EQUITY_STOCKS.slice(0, 8).map(s => s.instrumentKey);

export default function MarketTicker() {
  const { prices } = useMarket();

  const items = useMemo(() => {
    const keys = [...TICKER_INDICES, ...TOP_STOCKS];
    return keys.map(key => {
      const stock = [...INDEX_STOCKS, ...EQUITY_STOCKS].find(s => s.instrumentKey === key);
      const price = prices.get(key);
      return {
        key,
        symbol: stock?.tradingsymbol || key.split('|')[1],
        ltp: price?.ltp ?? stock?.basePrice ?? 0,
        changePercent: price?.changePercent ?? 0,
      };
    });
  }, [prices]);

  // Double for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--ticker-height)',
        background: 'rgba(10,10,15,0.95)',
        borderBottom: '1px solid var(--border-glass)',
        zIndex: 1000,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="ticker-track" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {doubled.map((item, i) => {
          const pos = item.changePercent >= 0;
          return (
            <span
              key={`${item.key}-${i}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 20px',
                fontSize: '11px',
                fontFamily: 'Space Grotesk, sans-serif',
                whiteSpace: 'nowrap',
                borderRight: '1px solid var(--border-glass)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.symbol}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtPrice(item.ltp)}</span>
              <span style={{ color: pos ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight: 600 }}>
                {pos ? '▲' : '▼'} {formatPercent(Math.abs(item.changePercent), false)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
