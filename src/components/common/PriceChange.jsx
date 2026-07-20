/* PriceChange.jsx */
import { useEffect, useRef } from 'react';
import { formatCurrency, formatPercent } from '../../utils/formatting.js';

const SIZE_MAP = {
  xs: { font: '11px', arrowFont: '10px', gap: '3px' },
  sm: { font: '12px', arrowFont: '11px', gap: '4px' },
  md: { font: '13px', arrowFont: '12px', gap: '4px' },
  lg: { font: '15px', arrowFont: '14px', gap: '5px' },
  xl: { font: '18px', arrowFont: '16px', gap: '6px' },
};

export default function PriceChange({ amount = 0, percent, size = 'md', showArrow = true, showAmount = true }) {
  const ref = useRef(null);
  const prevRef = useRef(amount);

  useEffect(() => {
    if (amount === prevRef.current) return;
    const el = ref.current;
    if (!el) return;
    const cls = amount > prevRef.current ? 'flash-up' : 'flash-down';
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // reflow
    el.classList.add(cls);
    const timer = setTimeout(() => el.classList.remove(cls), 600);
    prevRef.current = amount;
    return () => clearTimeout(timer);
  }, [amount]);

  const isPositive = amount >= 0;
  const color = isPositive ? 'var(--color-buy)' : 'var(--color-sell)';
  const sz = SIZE_MAP[size] || SIZE_MAP.md;
  const arrow = isPositive ? '▲' : '▼';

  return (
    <span
      ref={ref}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sz.gap,
        color,
        fontSize: sz.font,
        fontWeight: 600,
        fontFamily: 'Space Grotesk, sans-serif',
        whiteSpace: 'nowrap',
        transition: 'color 200ms ease',
      }}
    >
      {showArrow && (
        <span style={{ fontSize: sz.arrowFont, lineHeight: 1 }}>{arrow}</span>
      )}
      {showAmount && (
        <span>{formatCurrency(Math.abs(amount))}</span>
      )}
      {percent !== undefined && (
        <span style={{ opacity: 0.85 }}>({formatPercent(percent)})</span>
      )}
    </span>
  );
}
