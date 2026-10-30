/* Badge.jsx */
import React from 'react';

const TYPE_STYLES = {
  // Trade sides
  BUY:       { bg: 'rgba(38, 166, 154, 0.12)', color: 'var(--price-up)', border: 'rgba(38, 166, 154, 0.35)' },
  SELL:      { bg: 'rgba(239, 83, 80, 0.12)',  color: 'var(--price-down)', border: 'rgba(239, 83, 80, 0.35)' },
  // Product types
  CNC:       { bg: 'var(--bg-surface-raised)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
  MIS:       { bg: 'rgba(245, 166, 35, 0.10)', color: 'var(--accent-primary)', border: 'rgba(245, 166, 35, 0.30)' },
  NRML:      { bg: 'rgba(59, 130, 246, 0.10)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.30)' },
  CO:        { bg: 'rgba(6, 182, 212, 0.10)',  color: '#22D3EE', border: 'rgba(6, 182, 212, 0.30)' },
  // Order statuses
  COMPLETE:  { bg: 'rgba(38, 166, 154, 0.12)', color: 'var(--price-up)', border: 'rgba(38, 166, 154, 0.35)' },
  REJECTED:  { bg: 'rgba(239, 83, 80, 0.12)',  color: 'var(--price-down)', border: 'rgba(239, 83, 80, 0.35)' },
  OPEN:      { bg: 'rgba(245, 166, 35, 0.10)', color: 'var(--accent-primary)', border: 'rgba(245, 166, 35, 0.30)' },
  CANCELLED: { bg: 'var(--bg-surface-raised)', color: 'var(--text-tertiary)', border: 'var(--border-subtle)' },
  PENDING:   { bg: 'rgba(59, 130, 246, 0.10)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.30)' },
  // Alert / GTT statuses
  ACTIVE:    { bg: 'rgba(38, 166, 154, 0.12)', color: 'var(--price-up)', border: 'rgba(38, 166, 154, 0.35)' },
  TRIGGERED: { bg: 'rgba(59, 130, 246, 0.10)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.30)' },
  EXPIRED:   { bg: 'var(--bg-surface-raised)', color: 'var(--text-tertiary)', border: 'var(--border-subtle)' },
  // Order types
  MARKET:    { bg: 'var(--bg-surface-raised)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
  LIMIT:     { bg: 'rgba(59, 130, 246, 0.10)', color: '#60A5FA', border: 'rgba(59, 130, 246, 0.30)' },
  SL:        { bg: 'rgba(245, 166, 35, 0.10)', color: 'var(--accent-primary)', border: 'rgba(245, 166, 35, 0.30)' },
  'SL-M':    { bg: 'rgba(245, 166, 35, 0.10)', color: 'var(--accent-primary)', border: 'rgba(245, 166, 35, 0.30)' },
};

const SIZE_STYLES = {
  sm: { fontSize: '10px', padding: '1px 5px', borderRadius: 'var(--radius-xs)' },
  md: { fontSize: '11px', padding: '2px 6px', borderRadius: 'var(--radius-sm)' },
  lg: { fontSize: '12px', padding: '3px 8px', borderRadius: 'var(--radius-md)' },
};

export default function Badge({ type = '', size = 'md', children }) {
  const key = String(type).toUpperCase();
  const style = TYPE_STYLES[key] || { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' };
  const sz = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
        ...sz,
      }}
    >
      {children || type}
    </span>
  );
}
