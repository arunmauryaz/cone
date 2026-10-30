/* SearchBar.jsx */
import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  autoFocus = false,
  style = {},
}) {
  const inputRef = useRef(null);

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      ...style,
    }}>
      <Search
        size={14}
        style={{
          position: 'absolute',
          left: 10,
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      />
      <input
        ref={inputRef}
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          paddingLeft: 32,
          paddingRight: value ? 32 : 12,
          width: '100%',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => { onClear?.(); onChange?.(''); inputRef.current?.focus(); }}
          style={{
            position: 'absolute',
            right: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
          }}
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
