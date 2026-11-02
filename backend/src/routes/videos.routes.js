/**
 * videos.routes.js
 *
 * POST   /api/videos/generate       — submit property + images, start job
 * GET    /api/videos/jobs/:jobId    — poll status
 * GET    /api/videos/:jobId/stream  — stream MP4 (range-request aware)
 * GET    /api/videos/:jobId/download — download MP4
 *
 * Route order matters: /jobs/:jobId must be declared before /:jobId/*
 * so Express doesn't confuse "jobs" with a jobId value.
 */

import { Router }          from 'express';
import { imageUpload }     from '../middleware/upload.js';
import {
  generateVideoHandler,
  getJobStatus,
  streamVideo,
  downloadVideo,
} from '../controllers/videos.controller.js';

const router = Router();

// Submit + start
router.post('/generate',             imageUpload.array('images', 8), generateVideoHandler);

// Poll
router.get('/jobs/:jobId',           getJobStatus);

// Serve / download  (specific paths before generic /:jobId)
router.get('/:jobId/stream',         streamVideo);
router.get('/:jobId/download',       downloadVideo);

export default router;
