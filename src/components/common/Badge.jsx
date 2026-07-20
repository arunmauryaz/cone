/* Badge.jsx */
import React from 'react';

const TYPE_STYLES = {
  // Trade sides
  BUY:       { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  SELL:      { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  // Product types
  CNC:       { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' },
  MIS:       { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  NRML:      { bg: 'rgba(99,102,241,0.15)',  color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
  CO:        { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', border: 'rgba(6,182,212,0.3)' },
  // Order statuses
  COMPLETE:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  REJECTED:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  OPEN:      { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  CANCELLED: { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' },
  PENDING:   { bg: 'rgba(99,102,241,0.15)',  color: '#6366f1', border: 'rgba(99,102,241,0.3)' },
  // Alert / GTT statuses
  ACTIVE:    { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', border: 'rgba(16,185,129,0.3)' },
  TRIGGERED: { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', border: 'rgba(6,182,212,0.3)' },
  EXPIRED:   { bg: 'rgba(136,136,170,0.15)', color: '#8888aa', border: 'rgba(136,136,170,0.3)' },
  // Order types
  MARKET:    { bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
  LIMIT:     { bg: 'rgba(6,182,212,0.15)',   color: '#06b6d4', border: 'rgba(6,182,212,0.3)' },
  SL:        { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'SL-M':    { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
};

const SIZE_STYLES = {
  sm: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px' },
  md: { fontSize: '11px', padding: '3px 8px', borderRadius: '6px' },
  lg: { fontSize: '12px', padding: '4px 10px', borderRadius: '6px' },
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
