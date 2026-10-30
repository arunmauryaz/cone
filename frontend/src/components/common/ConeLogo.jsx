/* ConeLogo.jsx - Official CONE Blue Triangle Icon */
import React from 'react';

export default function ConeLogo({ size = 28, className = '', glow = false }) {
  const gradientId = `coneLogoGrad_${size}`;
  const facetId = `coneFacetGrad_${size}`;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'rgba(37, 99, 235, 0.4)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', position: 'relative', zIndex: 1 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="45%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={facetId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.0" />
          </linearGradient>
          <filter id={`shadow_${size}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1D4ED8" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Outer Triangle Body */}
        <path
          d="M50 8 C52 4 56 4 58 8 L95 78 C97 82 95 87 90 87 L10 87 C5 87 3 82 5 78 Z"
          fill={`url(#${gradientId})`}
          filter={`url(#shadow_${size})`}
        />

        {/* Right Bevel / 3D Depth Facet */}
        <path
          d="M54 8 L95 78 C97 82 95 87 90 87 L50 87 L50 10 Z"
          fill="rgba(0, 0, 0, 0.18)"
        />

        {/* Top-Left Gloss Highlight */}
        <path
          d="M50 10 L20 75 L50 50 Z"
          fill={`url(#${facetId})`}
        />

        {/* Inner Sleek Geo Core Triangle */}
        <polygon
          points="50,30 72,73 28,73"
          fill="rgba(255, 255, 255, 0.16)"
        />
      </svg>
    </div>
  );
}
