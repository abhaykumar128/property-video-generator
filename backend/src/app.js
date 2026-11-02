/**
 * app.js
 * Creates and configures the Express application instance.
 * server.js handles the actual listen() call.
 */

import express    from 'express';
import cors       from 'cors';
import path       from 'path';
import { fileURLToPath } from 'url';
import fs         from 'fs';

import { errorHandler }  from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

import healthRoutes  from './routes/health.routes.js';
import scriptRoutes  from './routes/scripts.routes.js';
import videoRoutes   from './routes/videos.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure runtime directories exist at startup
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'outputs');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

// ── Global middleware ────────────────────────────────────────────
app.use(cors({
  origin:  process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  exposedHeaders: ['Content-Disposition', 'Content-Length'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/health',   healthRoutes);
app.use('/api/scripts',  scriptRoutes);
app.use('/api/videos',   videoRoutes);

// ── Serve generated MP4 files ────────────────────────────────────
// /outputs/<jobId>.mp4 is used by the stream and download endpoints
// but also available directly for debugging.
app.use('/outputs', express.static(OUTPUT_DIR));

// ── 404 for unknown API routes ───────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

// ── Catch-all error handler (must be last) ───────────────────────
app.use(errorHandler);

export default app;
