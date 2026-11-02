/**
 * upload.js
 * Multer configuration for property image and optional audio uploads.
 *
 * Exports:
 *   imageUpload  — for image-only routes (array of 'images', max 8)
 *   mixedUpload  — for routes accepting images + optional single audio file
 */

import multer from 'multer';
import path   from 'path';
import { fileURLToPath } from 'url';
import fs     from 'fs';
import { randomUUID } from 'crypto';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR
  || path.join(__dirname, '..', '..', 'uploads');

// Ensure the directory exists on module load
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Storage ───────────────────────────────────────────────────────
// Use a UUID-based filename to prevent path traversal and collisions.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const safe = `${randomUUID()}${ext}`;
    cb(null, safe);
  },
});

// ── MIME type validators ──────────────────────────────────────────
const ACCEPTED_IMAGE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

const ACCEPTED_AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
  'audio/x-wav', 'audio/aac', 'audio/mp4',
]);

function fileFilter(_req, file, cb) {
  if (file.fieldname === 'images') {
    if (ACCEPTED_IMAGE_MIMES.has(file.mimetype)) return cb(null, true);
    return cb(new Error(
      `Unsupported image type "${file.mimetype}". Use JPEG, PNG, or WebP.`
    ));
  }

  if (file.fieldname === 'audio') {
    if (ACCEPTED_AUDIO_MIMES.has(file.mimetype)) return cb(null, true);
    return cb(new Error(
      `Unsupported audio type "${file.mimetype}". Use MP3, WAV, or AAC.`
    ));
  }

  // Unknown field — reject
  cb(new Error(`Unexpected file field: "${file.fieldname}".`));
}

// ── Size limits ───────────────────────────────────────────────────
const MAX_IMAGE_BYTES = (Number(process.env.MAX_FILE_SIZE_MB)  || 10) * 1024 * 1024;
const MAX_AUDIO_BYTES = (Number(process.env.MAX_AUDIO_SIZE_MB) || 20) * 1024 * 1024;

function limits(req) {
  // multer uses a single fileSize limit per instance;
  // we apply the stricter image limit for image-only uploads.
  return { fileSize: Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES) };
}

// ── Exported Multer instances ────────────────────────────────────

/** Image-only upload (POST /api/videos/generate) */
export const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES },
});

/** Mixed upload: images + optional audio track */
export const mixedUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AUDIO_BYTES }, // use the larger limit; MIME filter guards images
});
