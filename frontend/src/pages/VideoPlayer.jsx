/**
 * VideoPlayer.jsx
 * Step 4 — polls the backend for job status and displays:
 *   - A progress indicator while rendering
 *   - The native <video> player once done
 *   - A Download button
 *   - A Start Over button
 */

import React, { useEffect, useRef, useState } from 'react';
import { getVideoStatus } from '../api/videoApi.js';
import '../styles/player.css';

const POLL_INTERVAL_MS = 2500;

export default function VideoPlayer({ jobId, onBack, onReset }) {
  const [status,   setStatus]   = useState('processing'); // 'processing' | 'done' | 'error'
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    function poll() {
      getVideoStatus(jobId)
        .then((data) => {
          setStatus(data.status);
          if (data.status === 'done') {
            setVideoUrl(data.videoUrl);
            clearInterval(timerRef.current);
          } else if (data.status === 'error') {
            setErrorMsg(data.error || 'An unknown error occurred.');
            clearInterval(timerRef.current);
          }
        })
        .catch((err) => {
          setErrorMsg(err.message);
          setStatus('error');
          clearInterval(timerRef.current);
        });
    }

    poll(); // immediate first check
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [jobId]);

  // Build the absolute URL for download — works via Vite proxy in dev,
  // and directly against the backend origin in production.
  const apiBase   = import.meta.env.VITE_API_URL ?? '';
  const fullUrl   = videoUrl ? `${apiBase}${videoUrl}` : null;

  return (
    <div className="player-card">
      <h2 className="form-heading">Your Promotional Video</h2>

      {status === 'processing' && (
        <div className="player-loading">
          <div className="spinner spinner--large" aria-label="Rendering video" />
          <p className="player-status">Rendering your video — this takes 20–40 seconds…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="player-error">
          <p className="error-text" role="alert">
            Video generation failed: {errorMsg}
          </p>
          <p className="error-hint">
            Make sure FFmpeg is installed and on your PATH, then try again.
          </p>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          </div>
        </div>
      )}

      {status === 'done' && fullUrl && (
        <div className="player-ready">
          {/* Native HTML5 video player */}
          <video
            className="video-player"
            controls
            autoPlay
            loop
            src={fullUrl}
            aria-label="Generated promotional video"
          >
            Your browser does not support the video tag.
          </video>

          <div className="player-actions">
            <a
              href={fullUrl}
              download={`property-video-${jobId}.mp4`}
              className="btn btn-primary"
            >
              ⬇ Download MP4
            </a>
            <button className="btn btn-secondary" onClick={onReset}>
              ↺ Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
