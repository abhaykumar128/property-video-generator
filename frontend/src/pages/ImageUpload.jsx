/**
 * ImageUpload.jsx  — Step 2
 * Drag-and-drop image picker with thumbnail previews and reordering.
 * Object URLs are revoked on removal and unmount to prevent memory leaks.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import StatusMessage from '../components/StatusMessage.jsx';
import './ImageUpload.css';

const MIN = 4;
const MAX = 8;
const MAX_MB = 10;
const ACCEPTED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function createEntry(file) {
  return { file, previewUrl: URL.createObjectURL(file), id: `${Date.now()}-${Math.random()}` };
}

export default function ImageUpload({ onSubmit, onBack, imageCount }) {
  const [entries,  setEntries]  = useState([]);
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState(null);
  const [dragOver, setDragOver] = useState(null); // index being dragged over for reorder
  const inputRef = useRef(null);
  const dragSrc  = useRef(null);

  // Revoke all object URLs on unmount
  useEffect(() => () => entries.forEach((e) => URL.revokeObjectURL(e.previewUrl)), []);

  function addFiles(raw) {
    setError(null);
    const incoming = Array.from(raw);
    const rejected = [];
    const valid    = [];

    for (const f of incoming) {
      if (!ACCEPTED.has(f.type)) { rejected.push(`"${f.name}" is not a supported format (JPEG, PNG, WebP).`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { rejected.push(`"${f.name}" exceeds the ${MAX_MB} MB limit.`); continue; }
      valid.push(f);
    }

    if (rejected.length) { setError(rejected.join(' ')); }
    setEntries((prev) => {
      const combined = [...prev, ...valid.map(createEntry)];
      if (combined.length > MAX) { setError(`Maximum ${MAX} images allowed. Extra images were ignored.`); }
      return combined.slice(0, MAX);
    });
  }

  function remove(idx) {
    setEntries((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
    setError(null);
  }

  // ── Drag-and-drop reordering ────────────────────────────────
  function onDragStartThumb(e, idx) {
    dragSrc.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOverThumb(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(idx);
  }
  function onDropThumb(e, idx) {
    e.preventDefault();
    setDragOver(null);
    if (dragSrc.current === null || dragSrc.current === idx) return;
    setEntries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSrc.current, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragSrc.current = null;
  }
  function onDragEndThumb() { setDragOver(null); dragSrc.current = null; }

  // ── Drop-zone drag events ────────────────────────────────────
  function onZoneDragOver(e)  { e.preventDefault(); setDragging(true); }
  function onZoneDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }
  function onZoneDrop(e)      { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }

  function handleSubmit() {
    if (entries.length < MIN) { setError(`Upload at least ${MIN} images.`); return; }
    onSubmit(entries.map((e) => e.file));
  }

  const remaining = MAX - entries.length;

  return (
    <div className="card">
      <h2 className="card-heading">Upload Property Images</h2>
      <p className="muted-text" style={{ marginBottom: '1.25rem' }}>
        Add <strong>{MIN}–{MAX}</strong> images in JPEG, PNG, or WebP format (max {MAX_MB} MB each).
        Drag thumbnails to reorder scenes.
      </p>

      {error && <StatusMessage type="error" onDismiss={() => setError(null)}>{error}</StatusMessage>}

      {/* Drop zone */}
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onDragOver={onZoneDragOver}
        onDragLeave={onZoneDragLeave}
        onDrop={onZoneDrop}
        onClick={() => entries.length < MAX && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        role="button"
        tabIndex={entries.length < MAX ? 0 : -1}
        aria-label="Click or drag and drop images here"
        aria-disabled={entries.length >= MAX}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
          multiple style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div className="drop-zone__icon">🖼️</div>
        <div className="drop-zone__text">
          {entries.length === 0
            ? <><strong>Click to browse</strong> or drag images here</>
            : remaining > 0
              ? <><strong>{entries.length}</strong> image{entries.length !== 1 ? 's' : ''} selected — add up to <strong>{remaining}</strong> more</>
              : <span>Maximum {MAX} images reached</span>}
        </div>
        <div className="drop-zone__sub">JPEG · PNG · WebP · max {MAX_MB} MB each</div>
      </div>

      {/* Thumbnails */}
      {entries.length > 0 && (
        <ul className="thumb-grid" aria-label="Selected images">
          {entries.map((entry, i) => (
            <li key={entry.id}
              className={`thumb-item${dragOver === i ? ' thumb-item--over' : ''}`}
              draggable
              onDragStart={(e) => onDragStartThumb(e, i)}
              onDragOver={(e)  => onDragOverThumb(e, i)}
              onDrop={(e)      => onDropThumb(e, i)}
              onDragEnd={onDragEndThumb}
              title="Drag to reorder"
            >
              <img src={entry.previewUrl} alt={`Preview ${i + 1}`} className="thumb-img" />
              <span className="thumb-badge">{i + 1}</span>
              <button className="thumb-remove" onClick={() => remove(i)}
                aria-label={`Remove image ${i + 1}`} title="Remove">✕</button>
              <span className="thumb-drag-hint">⠿</span>
            </li>
          ))}
        </ul>
      )}

      {/* Progress indicator */}
      <div className="img-count-bar">
        <div className="img-count-segments">
          {Array.from({ length: MAX }).map((_, i) => (
            <div key={i} className={`img-count-seg${i < entries.length ? ' filled' : ''}${i < MIN ? ' required' : ''}`} />
          ))}
        </div>
        <span className="img-count-label">
          {entries.length < MIN
            ? `${MIN - entries.length} more required`
            : entries.length === MAX
              ? 'Maximum reached'
              : `${entries.length} / ${MAX} images`}
        </span>
      </div>

      <div className="form-actions form-actions--between">
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={entries.length < MIN}>
          Next: Generate Script →
        </button>
      </div>
    </div>
  );
}
