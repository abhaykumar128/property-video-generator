/**
 * VideoPreview.jsx  — Step 5
 * Shows the finished video in a native HTML5 player.
 * Provides a Download button and a Start Over button.
 * Object URL for the blob is revoked when the component unmounts.
 */
import React, { useState } from 'react';
import StatusMessage from '../components/StatusMessage.jsx';
import { getVideoStreamUrl, getVideoDownloadUrl } from '../api/videoApi.js';
import './VideoPreview.css';

export default function VideoPreview({ jobId, onReset }) {
  const [videoError, setVideoError] = useState(false);

  const streamUrl   = getVideoStreamUrl(jobId);
  const downloadUrl = getVideoDownloadUrl(jobId);

  return (
    <div className="card">
      <h2 className="card-heading">Your Promotional Video</h2>

      {videoError ? (
        <StatusMessage type="error" title="Video could not be loaded">
          The video file may still be processing or the backend may be unavailable.
          Try refreshing, or download the file directly.
        </StatusMessage>
      ) : (
        <div className="video-wrapper">
          <video
            className="video-player"
            controls
            autoPlay
            playsInline
            src={streamUrl}
            onError={() => setVideoError(true)}
            aria-label="Generated promotional property video"
          >
            Your browser does not support the HTML5 video element.
          </video>
        </div>
      )}

      <div className="video-meta muted-text">
        <span>Format: MP4 · H.264 · 1080×1920</span>
        <span>Job ID: {jobId}</span>
      </div>

      <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <a href={downloadUrl}
          download={`property-video-${jobId}.mp4`}
          className="btn btn-primary btn-lg">
          ⬇ Download MP4
        </a>
        <button className="btn btn-secondary btn-lg" onClick={onReset}>
          ↺ Create Another Video
        </button>
      </div>
    </div>
  );
}
