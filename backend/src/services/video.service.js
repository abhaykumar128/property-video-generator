/**
 * video.service.js
 * Orchestrates the full video pipeline for a given jobId:
 *
 *   1. Generate script  (Gemini text → template fallback)
 *   2. Build PNG frames  (Sharp – 1080×1920, text overlays)
 *   3. Render MP4        (FFmpeg – H.264, xfade transitions, optional audio)
 *   4. Verify output     (file exists, non-zero size)
 *   5. Update job record (completed / failed)
 *
 * Video rendering uses the local FFmpeg bundled binary (ffmpeg-static).
 * No external video API is required — the application works fully offline.
 *
 * Gemini is used only for the text script (step 1) with a template fallback.
 */

import path            from 'path';
import fs              from 'fs';
import { fileURLToPath } from 'url';

import { getJob, updateJob }   from './job.service.js';
import { generateScript }      from './gemini.service.js';
import { buildFrames }         from '../utils/frameRenderer.js';
import { renderMp4 }           from '../utils/ffmpegRenderer.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.OUTPUT_DIR
  || path.join(__dirname, '..', '..', 'outputs');

/**
 * Run the full video pipeline for a job.
 * Called fire-and-forget from the videos controller.
 *
 * @param {string} jobId
 * @returns {Promise<void>}
 */
export async function runVideoJob(jobId) {
  const job = getJob(jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);

  let framePaths = [];

  try {
    // ── Step 1: Generate script ──────────────────────────────
    updateJob(jobId, {
      status:   'processing',
      progress: 'Generating promotional script…',
    });

    const script = await generateScript(job.property, job.files.length);
    updateJob(jobId, { script, progress: 'Script ready. Building frames…' });

    // ── Step 2: Prepare PNG frames ───────────────────────────
    const imagePaths = job.files.map((f) => f.path);
    validateImagePaths(imagePaths);

    framePaths = await buildFrames(imagePaths, script.scenes, script);
    updateJob(jobId, { progress: `${framePaths.length} frames ready. Rendering video…` });

    // ── Step 3: Render MP4 ───────────────────────────────────
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `${jobId}.mp4`);

    // Optional audio — stored under the 'audio' fieldname by Multer
    const audioFile = (job.files || []).find((f) => f.fieldname === 'audio');
    const audioPath = audioFile?.path ?? null;

    await renderMp4(framePaths, outputPath, audioPath);

    // ── Step 4: Verify output ────────────────────────────────
    const stat = fs.statSync(outputPath);
    if (stat.size === 0) throw new Error('Rendered MP4 is empty.');

    // ── Step 5: Mark job completed ───────────────────────────
    const videoUrl = `/outputs/${jobId}.mp4`;
    updateJob(jobId, {
      status:   'completed',
      progress: `Video ready (${(stat.size / 1024).toFixed(0)} KB).`,
      videoUrl,
    });

    console.log(`[video] Job ${jobId} completed → ${outputPath}`);

  } catch (err) {
    const safeMsg = String(err.message || err).slice(0, 500);
    console.error(`[video] Job ${jobId} failed:`, safeMsg);
    updateJob(jobId, {
      status:   'failed',
      progress: 'Video generation failed.',
      error:    safeMsg,
    });
    throw err;

  } finally {
    // Always clean up temp frames, whether we succeeded or failed
    cleanupFrames(framePaths);
  }
}

// ── Internal helpers ─────────────────────────────────────────────

function validateImagePaths(imagePaths) {
  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('No image files found for this job.');
  }
  for (const p of imagePaths) {
    if (!fs.existsSync(p)) {
      throw new Error(`Uploaded image not found on disk: ${path.basename(p)}`);
    }
  }
}

function cleanupFrames(framePaths) {
  if (!framePaths || framePaths.length === 0) return;
  for (const fp of framePaths) {
    try { fs.unlinkSync(fp); } catch { /* best-effort */ }
  }
  try {
    const dir = path.dirname(framePaths[0]);
    if (dir && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch { /* best-effort */ }
}
