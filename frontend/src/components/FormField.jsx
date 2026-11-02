/**
 * FormField.jsx
 * Label + control + hint + error wrapper.
 * Injects id / aria-* onto the single child via cloneElement.
 */
import React from 'react';

export default function FormField({ label, hint, error, required, children }) {
  const id      = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const errorId = `${id}-err`;
  const hintId  = `${id}-hint`;
  const ariaDesc = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined;
  const child    = React.Children.only(children);
  const enhanced = React.cloneElement(child, {
    id,
    'aria-describedby': ariaDesc,
    'aria-invalid':     error ? true : undefined,
    'aria-required':    required || undefined,
    className: ['form-control', error ? 'error' : '', child.props.className ?? ''].filter(Boolean).join(' '),
  });
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        {label}{required && <span aria-hidden="true" style={{ color: 'var(--color-error)', marginLeft: '0.2rem' }}>*</span>}
      </label>
      {enhanced}
      {hint  && <span id={hintId}  className="form-hint">{hint}</span>}
      {error && <span id={errorId} className="form-error" role="alert">{error}</span>}
    </div>
  );
}
