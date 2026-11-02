/**
 * videos.controller.js
 *
 * POST   /api/videos/generate        — validate + create job + start pipeline
 * GET    /api/videos/jobs/:jobId      — poll job status
 * GET    /api/videos/:jobId/stream    — stream completed MP4
 * GET    /api/videos/:jobId/download  — download completed MP4
 */

import path   from 'path';
import fs     from 'fs';
import { fileURLToPath } from 'url';
import { videoRequestSchema }   from '../utils/validation.js';
import { createJob, getJob, updateJob } from '../services/job.service.js';
import { runVideoJob }          from '../services/video.service.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR
  || path.join(__dirname, '..', '..', 'outputs');

// ── POST /api/videos/generate ────────────────────────────────────
export async function generateVideoHandler(req, res, next) {
  try {
    const files = req.files ?? [];

    // Parse the "data" field (JSON string in multipart form)
    let rawData;
    try {
      rawData = JSON.parse(req.body.data ?? '{}');
    } catch {
      return res.status(400).json({ error: 'The "data" field must be valid JSON.' });
    }

    // Validate property fields
    const parsed = videoRequestSchema.safeParse(rawData);
    if (!parsed.success) {
      return res.status(422).json({
        error:  'Validation failed.',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    // Validate image count (4–8 required)
    const images = files.filter((f) => f.fieldname === 'images');
    if (images.length < 4) {
      return res.status(422).json({
        error: `At least 4 images are required. Received ${images.length}.`,
      });
    }

    // Create job record
    const job = createJob(parsed.data, images);

    // Fire-and-forget — client polls /jobs/:jobId
    runVideoJob(job.id).catch(() => {
      // Error is already stored on the job record inside runVideoJob
    });

    return res.status(202).json({
      jobId:   job.id,
      status:  'queued',
      message: 'Video generation started. Poll GET /api/videos/jobs/:jobId for updates.',
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/videos/jobs/:jobId ──────────────────────────────────
export function getJobStatus(req, res, next) {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: `No job found with id "${req.params.jobId}".` });
    }

    const response = {
      jobId:    job.id,
      status:   job.status,
      progress: job.progress,
      script:   job.script,   // null until script step completes
    };

    if (job.status === 'completed') response.videoUrl  = job.videoUrl;
    if (job.status === 'failed')    response.error     = job.error;

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/videos/:jobId/stream ────────────────────────────────
export function streamVideo(req, res, next) {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: `No job found with id "${req.params.jobId}".` });
    }
    if (job.status !== 'completed') {
      return res.status(409).json({ error: `Job is not completed yet (status: ${job.status}).` });
    }

    const filePath = resolveVideoPath(job.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Video file not found on disk.' });
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      // Support HTTP range requests for browser <video> scrubbing
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunk = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk,
        'Content-Type':   'video/mp4',
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type':   'video/mp4',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
}

// ── GET /api/videos/:jobId/download ─────────────────────────────
export function downloadVideo(req, res, next) {
  try {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: `No job found with id "${req.params.jobId}".` });
    }
    if (job.status !== 'completed') {
      return res.status(409).json({ error: `Job is not completed yet (status: ${job.status}).` });
    }

    const filePath = resolveVideoPath(job.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Video file not found on disk.' });
    }

    // Sanitize filename: only jobId (UUID) + .mp4 — no user-supplied strings
    const safeFilename = `property-video-${job.id}.mp4`;

    res.setHeader('Content-Type',        'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Resolve the local MP4 path for a job.
 * Only looks inside OUTPUT_DIR — never accepts arbitrary paths.
 */
function resolveVideoPath(jobId) {
  // jobId is a UUID — safe to use directly as a filename
  const filePath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
  return fs.existsSync(filePath) ? filePath : null;
}
