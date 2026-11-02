/**
 * requestLogger.js
 * Lightweight request logger — logs method, path, status, and duration.
 * No sensitive data (body, headers, query strings) is logged.
 */

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`
    );
  });
  next();
}
