/* Spinner.jsx */
import React from 'react';

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 36,
  xl: 48,
};

export default function Spinner({ size = 'md', color = 'var(--accent-primary)' }) {
  const px = sizeMap[size] ?? 24;
  return (
    <span
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: `2px solid rgba(255,255,255,0.1)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
