/* EmptyState.jsx */
import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-2xl) var(--space-lg)',
      textAlign: 'center',
      gap: 'var(--space-md)',
    }}>
      {Icon && (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-primary)',
          marginBottom: 'var(--space-xs)',
        }}>
          <Icon size={24} />
        </div>
      )}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-xs)' }}>
          {title}
        </h3>
        {description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: 320 }}>
            {description}
          </p>
        )}
      </div>
      {action && actionLabel && (
        <button className="btn btn-primary btn-sm" onClick={action} style={{ marginTop: 'var(--space-xs)' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
