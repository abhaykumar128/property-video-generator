/**
 * errorHandler.js
 * Express catch-all error middleware (must have exactly 4 params).
 *
 * Translates known error types to appropriate HTTP responses.
 * Never leaks API keys, filesystem paths, or stack traces to clients.
 */

export function errorHandler(err, _req, res, _next) {
  // ── Multer errors ────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum allowed: ${process.env.MAX_FILE_SIZE_MB || 10} MB per image.`,
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files uploaded.' });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field name.' });
  }

  // ── Multer fileFilter errors (unsupported MIME type) ────────
  // Multer passes these through without a code so we match on message
  if (err.message && (
    err.message.includes('Unsupported image type') ||
    err.message.includes('Unsupported audio type') ||
    err.message.includes('Unexpected file field')
  )) {
    return res.status(400).json({ error: err.message });
  }

  // ── Application-level thrown errors ─────────────────────────
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error.';

  // Log server-side (sanitized — no secrets, no full stack in production)
  if (status >= 500) {
    console.error('[error]', err.constructor?.name ?? 'Error', ':', message);
  }

  return res.status(status).json({ error: message });
}
