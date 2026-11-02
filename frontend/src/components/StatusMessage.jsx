/**
 * StatusMessage.jsx
 * Inline alert banner — error / success / warning / info.
 * Renders text content only — never injects raw HTML.
 */
import React from 'react';
import './StatusMessage.css';

const ICONS = { error: '✕', success: '✓', warning: '⚠', info: 'ℹ' };

export default function StatusMessage({ type = 'info', title, children, onDismiss }) {
  if (!children && !title) return null;
  return (
    <div className={`status-msg status-msg--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="status-msg__icon" aria-hidden="true">{ICONS[type]}</span>
      <div className="status-msg__body">
        {title && <strong className="status-msg__title">{title}</strong>}
        {children && <span className="status-msg__text">{children}</span>}
      </div>
      {onDismiss && (
        <button className="status-msg__dismiss" onClick={onDismiss} aria-label="Dismiss">✕</button>
      )}
    </div>
  );
}
