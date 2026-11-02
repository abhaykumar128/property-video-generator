/**
 * ScriptPreview.jsx  — Step 3
 * Calls POST /api/scripts/generate, displays the result,
 * and allows users to edit individual scene captions before proceeding.
 * Video generation is NOT triggered here — that happens in step 4.
 */
import React, { useEffect, useState, useRef } from 'react';
import StatusMessage from '../components/StatusMessage.jsx';
import { generateScript } from '../api/videoApi.js';
import './ScriptPreview.css';

export default function ScriptPreview({ property, imageCount, onScriptReady, onBack }) {
  const [script,   setScript]   = useState(null);
  const [scenes,   setScenes]   = useState([]);   // locally editable copy
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const calledRef  = useRef(false);

  // Auto-generate on mount
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    fetchScript();
  }, []);

  async function fetchScript() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateScript(property, imageCount);
      const s   = res.script;
      setScript(s);
      setScenes(s.scenes.map((sc) => ({ ...sc })));  // editable copy
    } catch (err) {
      setError(err.message || 'Failed to generate script. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateCaption(idx, value) {
    setScenes((prev) => prev.map((s, i) => i === idx ? { ...s, caption: value } : s));
  }

  function handleContinue() {
    const merged = { ...script, scenes };
    onScriptReady(merged);
  }

  const sourceLabel = script?.source === 'gemini' ? 'AI-generated' : 'Template-based';
  const sourceBadge = script?.source === 'gemini' ? 'badge-blue' : 'badge-gray';

  return (
    <div className="card">
      <div className="script-header">
        <h2 className="card-heading" style={{ margin: 0 }}>Review Script</h2>
        {script && (
          <button className="btn btn-ghost btn-sm" onClick={fetchScript} disabled={loading}>
            ↻ Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div className="script-loading">
          <div className="spinner spinner--lg" aria-label="Generating script" />
          <p className="muted-text">Generating promotional script…</p>
        </div>
      )}

      {error && !loading && (
        <>
          <StatusMessage type="error">{error}</StatusMessage>
          <button className="btn btn-primary" onClick={fetchScript} style={{ marginTop: '0.5rem' }}>
            Try Again
          </button>
        </>
      )}

      {script && !loading && (
        <>
          <div className="script-source-row">
            <span className={`badge ${sourceBadge}`}>{sourceLabel}</span>
            <span className="muted-text" style={{ fontSize: '0.78rem' }}>
              {script.source === 'gemini'
                ? 'Generated using Google Gemini AI'
                : 'Generated using built-in templates'}
            </span>
          </div>

          {/* Opening title */}
          <div className="script-block">
            <span className="script-block__label">Opening Title</span>
            <p className="script-block__text script-block__text--headline">{script.openingTitle}</p>
          </div>

          {/* Scene captions — editable */}
          <div className="script-block">
            <span className="script-block__label">Scene Captions
              <span className="script-block__sublabel"> — click to edit</span>
            </span>
            <ol className="scene-list">
              {scenes.map((sc, i) => (
                <li key={i} className={`scene-item scene-item--${sc.type}`}>
                  <span className="scene-num">{i + 1}</span>
                  <div className="scene-edit">
                    <input
                      className="scene-caption-input"
                      value={sc.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
                      aria-label={`Scene ${i + 1} caption`}
                      maxLength={80}
                    />
                    <span className="scene-type-badge">{sc.type}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Call to action */}
          <div className="script-block script-block--cta">
            <span className="script-block__label">Call to Action</span>
            <p className="script-block__text">{script.callToAction}</p>
          </div>

          {/* Voice-over */}
          <details className="script-voiceover">
            <summary>Voice-over summary</summary>
            <p>{script.voiceOver}</p>
          </details>
        </>
      )}

      <div className="form-actions form-actions--between">
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>← Back</button>
        <button className="btn btn-primary btn-lg"
          onClick={handleContinue}
          disabled={!script || loading}>
          Next: Generate Video →
        </button>
      </div>
    </div>
  );
}
