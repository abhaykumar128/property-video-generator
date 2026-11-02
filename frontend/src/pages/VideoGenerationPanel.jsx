/**
 * VideoGenerationPanel.jsx  — Step 4
 * Shows the Generate Video button, tracks job progress via polling,
 * and hands off to VideoPreview when done.
 *
 * Polling stops on completion, failure, or unmount.
 * Duplicate clicks are prevented via the `started` ref.
 */
import React, { useState, useEffect, useRef } from 'react';
import StatusMessage from '../components/StatusMessage.jsx';
import { getVideoStatus } from '../api/videoApi.js';
import { submitProperty } from '../api/propertyApi.js';
import './VideoGenerationPanel.css';

const POLL_MS = 3000;

const STAGE_LABELS = {
  queued:      'Job queued…',
  processing:  'Processing…',
  completed:   'Video ready!',
  failed:      'Generation failed.',
};

export default function VideoGenerationPanel({ property, images, script, onDone, onBack }) {
  const [phase,    setPhase]    = useState('idle');   // idle | submitting | polling | done | failed
  const [progress, setProgress] = useState('');
  const [error,    setError]    = useState(null);
  const [jobId,    setJobId]    = useState(null);
  const timerRef  = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => () => clearInterval(timerRef.current), []);

  async function startGeneration() {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('submitting');
    setError(null);
    setProgress('Uploading images and property details…');

    try {
      const res = await submitProperty(property, images);
      setJobId(res.jobId);
      setPhase('polling');
      setProgress('Job accepted. Starting render…');
      startPolling(res.jobId);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setPhase('failed');
      startedRef.current = false;
    }
  }

  function startPolling(id) {
    timerRef.current = setInterval(async () => {
      try {
        const data = await getVideoStatus(id);
        setProgress(data.progress || STAGE_LABELS[data.status] || data.status);

        if (data.status === 'completed') {
          clearInterval(timerRef.current);
          setPhase('done');
          onDone(id, data.videoUrl);
        } else if (data.status === 'failed') {
          clearInterval(timerRef.current);
          setPhase('failed');
          setError(data.error || 'Video generation failed. Check the backend logs.');
        }
      } catch (err) {
        // Network blip — keep polling, but surface it
        setProgress(`Retrying… (${err.message})`);
      }
    }, POLL_MS);
  }

  function retry() {
    startedRef.current = false;
    setJobId(null);
    setPhase('idle');
    setError(null);
    setProgress('');
  }

  const isActive = phase === 'submitting' || phase === 'polling';

  return (
    <div className="card">
      <h2 className="card-heading">Generate Video</h2>

      {/* Summary card */}
      <div className="gen-summary">
        <div className="gen-summary__row">
          <span className="gen-summary__label">Property</span>
          <span className="gen-summary__value">{property.propertyName}</span>
        </div>
        <div className="gen-summary__row">
          <span className="gen-summary__label">Images</span>
          <span className="gen-summary__value">{images.length} image{images.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="gen-summary__row">
          <span className="gen-summary__label">Script</span>
          <span className="gen-summary__value">{script.scenes.length} scenes · {script.source === 'gemini' ? 'AI-generated' : 'Template-based'}</span>
        </div>
        <div className="gen-summary__row">
          <span className="gen-summary__label">Format</span>
          <span className="gen-summary__value">AI-generated · 1080 × 1920 · H.264 · ~20–40 s</span>
        </div>
      </div>

      {error && (
        <StatusMessage type="error" title="Generation failed">
          {error}
          {error.includes('GEMINI_API_KEY') && (
            <> Set the Gemini API key in <code>backend/.env</code> to enable AI video generation.</>
          )}
          {error.includes('FFmpeg') && (
            <> FFmpeg is used for caption overlay — see the README for details.</>
          )}
        </StatusMessage>
      )}

      {/* Progress area */}
      {isActive && (
        <div className="gen-progress">
          <div className="spinner spinner--xl" aria-label="AI video generation in progress" />
          <p className="gen-progress__text">{progress || 'Starting…'}</p>
          {jobId && <p className="muted-text" style={{ fontSize: '0.72rem' }}>Job ID: {jobId}</p>}
          <p className="muted-text" style={{ marginTop: '0.5rem' }}>
            AI video generation typically takes 1–3 minutes. Please wait.
          </p>
        </div>
      )}

      <div className="form-actions form-actions--between">
        <button className="btn btn-secondary"
          onClick={phase === 'failed' ? retry : onBack}
          disabled={isActive}>
          {phase === 'failed' ? '↺ Try Again' : '← Back'}
        </button>
        <button className="btn btn-primary btn-lg"
          onClick={startGeneration}
          disabled={isActive || phase === 'done'}>
          {isActive ? <><span className="spinner spinner--sm" style={{ borderTopColor: '#fff' }} /> Generating…</> : '🎬 Generate Property Video'}
        </button>
      </div>
    </div>
  );
}
