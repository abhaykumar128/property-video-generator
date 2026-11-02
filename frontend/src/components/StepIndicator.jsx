import React from 'react';

export default function StepIndicator({ steps, current }) {
  return (
    <div className="step-bar">
      <nav className="stepper" aria-label="Workflow progress">
        {steps.map((label, i) => {
          const state = i < current ? 'completed' : i === current ? 'active' : 'upcoming';
          return (
            <React.Fragment key={label}>
              <div
                className={`stepper__step stepper__step--${state}`}
                aria-current={i === current ? 'step' : undefined}
              >
                <span className="stepper__circle">
                  {i < current ? '✓' : i + 1}
                </span>
                <span className="stepper__label">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`stepper__line${i < current ? ' stepper__line--done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}
