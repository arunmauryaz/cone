/* GlassCard.jsx */
import React from 'react';

export default function GlassCard({ children, className = '', gradient = false, glow = false, hoverable = false, onClick, style }) {
  return (
    <div
      className={`glass-card${gradient ? ' gradient' : ''}${glow ? ' glow' : ''}${hoverable ? ' hoverable' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
