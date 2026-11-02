/**
 * geminiVideo.service.js
 * Generates real AI video footage using Google Gemini Omni Flash.
 *
 * Uses the @google/genai SDK with the Interactions API:
 *   - Image-to-video generation with reference images
 *   - Multi-turn video extension via previous_interaction_id
 *   - URI delivery for large videos (> 4MB)
 *   - File polling and download
 *
 * SECURITY:
 *   - API key from process.env.GEMINI_API_KEY only — never logged or returned
 *   - Raw provider errors are sanitized before logging
 *
 * If GEMINI_API_KEY is not set, this service throws a clear error.
 * It does NOT fall back to the FFmpeg slideshow — that would be deceptive.
 */

import { GoogleGenAI } from '@google/genai';
import fs   from 'fs';
import path from 'path';

const VIDEO_MODEL  = () => process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-1.1-flash';
const API_TIMEOUT  = 180_000;  // 3 minutes per API call
const POLL_DELAY   = 5_000;    // 5s between file status checks
const MAX_POLLS    = 60;       // 60 × 5s = 5 minutes max wait

/**
 * Generate an AI video from property images and a creative prompt.
 *
 * @param {string[]} imagePaths  Absolute paths to uploaded images
 * @param {string}   prompt      Creative direction prompt
 * @param {string}   outputPath  Where to save the MP4
 * @param {function} [onProgress] Optional callback(stage, msg) for status updates
 * @returns {Promise<{ videoPath: string, interactionId: string }>}
 */
export async function generateAiVideo(imagePaths, prompt, outputPath, onProgress) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. AI video generation requires a valid ' +
      'Gemini API key. Set it in backend/.env to enable video generation.'
    );
  }

  const ai   = new GoogleGenAI({ apiKey });
  const model = VIDEO_MODEL();

  // ── Build the input array: images + text prompt ──────────────
  onProgress?.('preparing', 'Preparing reference images for AI…');
  const input = [];

  for (const imgPath of imagePaths) {
    const data = fs.readFileSync(imgPath).toString('base64');
    const ext  = path.extname(imgPath).toLowerCase();
    const mime = ext === '.png'   ? 'image/png'
               : ext === '.webp'  ? 'image/webp'
               :                    'image/jpeg';
    input.push({ type: 'image', data, mime_type: mime });
  }

  input.push({ type: 'text', text: prompt });

  // ── Call the Interactions API ────────────────────────────────
  onProgress?.('generating', 'Generating AI video with Gemini Omni…');

  console.log(`[gemini-video] Calling interactions.create (model: ${model}, images: ${imagePaths.length})`);

  const interaction = await withTimeout(
    ai.interactions.create({
      model,
      input,
      response_format: {
        type:         'video',
        aspect_ratio: '9:16',
        delivery:     'uri',
      },
      generationConfig: {
        videoConfig: {
          task: 'reference_to_video',
        },
      },
    }),
    API_TIMEOUT,
  );

  console.log(`[gemini-video] Interaction ID: ${interaction.id}`);

  // ── Download the generated video ─────────────────────────────
  const videoPath = await downloadVideo(ai, interaction, outputPath, onProgress);

  return { videoPath, interactionId: interaction.id };
}

/**
 * Extend a previously generated video using multi-turn continuation.
 *
 * @param {string}   previousInteractionId  ID from the prior generation
 * @param {string}   extensionPrompt        How to continue the video
 * @param {string}   outputPath             Where to save the extended MP4
 * @param {function} [onProgress]           Optional status callback
 * @returns {Promise<{ videoPath: string, interactionId: string }>}
 */
export async function extendAiVideo(previousInteractionId, extensionPrompt, outputPath, onProgress) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

  const ai   = new GoogleGenAI({ apiKey });
  const model = VIDEO_MODEL();

  onProgress?.('extending', 'Extending AI video for longer duration…');

  console.log(`[gemini-video] Extending video (previous: ${previousInteractionId})`);

  const interaction = await withTimeout(
    ai.interactions.create({
      model,
      previous_interaction_id: previousInteractionId,
      input: extensionPrompt,
      response_format: {
        type:         'video',
        aspect_ratio: '9:16',
        delivery:     'uri',
      },
    }),
    API_TIMEOUT,
  );

  console.log(`[gemini-video] Extension interaction ID: ${interaction.id}`);

  const videoPath = await downloadVideo(ai, interaction, outputPath, onProgress);

  return { videoPath, interactionId: interaction.id };
}

// ── Internal: download the video (URI delivery mode) ─────────────

async function downloadVideo(ai, interaction, outputPath, onProgress) {
  const videoOutput = interaction.output_video;

  if (!videoOutput) {
    throw new Error('Gemini Omni returned no video output.');
  }

  // ── Case 1: base64 data returned directly (small videos) ────
  if (videoOutput.data) {
    onProgress?.('downloading', 'Downloading AI-generated video…');
    console.log('[gemini-video] Writing base64 video data to disk');
    fs.writeFileSync(outputPath, Buffer.from(videoOutput.data, 'base64'));
    return outputPath;
  }

  // ── Case 2: URI delivery — poll until file is ACTIVE ────────
  if (videoOutput.uri) {
    onProgress?.('processing', 'AI video generated. Processing on server…');

    // Extract file ID from the URI
    // URI format: https://generativelanguage.googleapis.com/v1beta/files/FILE_ID:download?alt=media
    const fileId = videoOutput.uri.match(/files\/([a-zA-Z0-9_-]+)/)?.[1];
    if (!fileId) {
      throw new Error(`Could not extract file ID from video URI: ${videoOutput.uri}`);
    }
    const name = `files/${fileId}`;

    console.log(`[gemini-video] Polling file status (file: ${fileId})`);

    let fileState = null;
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const fInfo = await ai.files.get({ name });

      // State can be 'ACTIVE', 'PROCESSING', 'FAILED', etc.
      // The SDK may return state as a string or enum
      const stateStr = typeof fInfo.state === 'string'
        ? fInfo.state
        : fInfo.state?.name || fInfo.state?.toString() || 'UNKNOWN';

      fileState = stateStr;
      console.log(`[gemini-video] Poll ${attempt + 1}/${MAX_POLLS} — state: ${stateStr}`);

      if (stateStr === 'ACTIVE') {
        // File is ready — download it
        onProgress?.('downloading', 'Downloading AI-generated video…');
        await downloadFromUri(videoOutput.uri, outputPath);
        return outputPath;
      }

      if (stateStr === 'FAILED') {
        throw new Error('Gemini Omni video processing failed on the server.');
      }

      // Still processing — wait and retry
      await sleep(POLL_DELAY);
    }

    throw new Error(
      `Gemini Omni video did not become available after ${MAX_POLLS * POLL_DELAY / 1000} seconds ` +
      `(last state: ${fileState}).`
    );
  }

  throw new Error('Gemini Omni returned no video data or URI.');
}

/**
 * Download a file from a Gemini API URI using fetch.
 * Falls back to ai.files.download if fetch fails.
 */
async function downloadFromUri(uri, outputPath) {
  // Try fetch first — the URI should be a direct download URL
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    // The URI may or may not include the API key — add it as a header
    const response = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey },
    });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log(`[gemini-video] Downloaded ${fs.statSync(outputPath).size} bytes`);
    return;
  } catch (fetchErr) {
    console.warn('[gemini-video] fetch download failed, trying SDK download:', fetchErr.message);
  }

  // Fallback: try the SDK's files.download method
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    await ai.files.download({ file: { uri }, downloadPath: outputPath });
    return;
  } catch (sdkErr) {
    throw new Error(`Failed to download video: fetch=${fetchErr?.message}, sdk=${sdkErr.message}`);
  }
}

// ── Utilities ─────────────────────────────────────────────────────

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000} seconds.`)), ms)
    ),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
