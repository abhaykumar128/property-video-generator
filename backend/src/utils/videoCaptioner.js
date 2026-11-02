/**
 * videoCaptioner.js
 * Overlays accurate property text on the AI-generated video using FFmpeg.
 *
 * Pipeline:
 *   1. Get the AI video's duration (via ffmpeg -i probe)
 *   2. Generate transparent PNG overlays with Sharp (text + gradient bars)
 *   3. Use FFmpeg to composite overlays at timed intervals
 *   4. Scale to 1080×1920 and re-encode to H.264
 *   5. Preserve AI-generated audio where present
 *
 * The captions come from the template/gemini script service — they use
 * only the user-supplied property facts. Text is rendered as SVG → PNG
 * with XML escaping to prevent injection.
 */

import sharp       from 'sharp';
import ffmpeg       from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs           from 'fs';
import path          from 'path';
import os            from 'os';
import { execFileSync } from 'child_process';

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg');

const OUT_W = 1080;
const OUT_H = 1920;

/**
 * Overlay timed captions on a video and produce the final MP4.
 *
 * @param {string}   videoPath  Path to the AI-generated MP4
 * @param {object}   script     Script from template/gemini service
 * @param {string}   outputPath Where to save the final MP4
 * @returns {Promise<void>}
 */
export async function overlayCaptions(videoPath, script, outputPath) {
  // ── Step 1: Probe the AI video's duration ────────────────────
  const duration = probeVideoDuration(videoPath);
  if (duration <= 0) {
    throw new Error('Could not determine AI video duration.');
  }
  console.log(`[captioner] AI video duration: ${duration.toFixed(1)}s`);

  // ── Step 2: Calculate caption timings ───────────────────────
  const scenes    = script.scenes;
  const sceneCount = scenes.length;
  const timings   = calculateTimings(sceneCount, duration);

  // ── Step 3: Generate transparent overlay PNGs ───────────────
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'pvg-overlay-'));
  const overlays = [];

  for (let i = 0; i < sceneCount; i++) {
    const scene = scenes[i];
    const topText    = scene.type === 'opening' ? script.openingTitle : '';
    const bottomText = scene.type === 'closing'  ? script.callToAction : scene.caption;

    const overlayPath = path.join(tmpDir, `overlay-${i}.png`);
    await renderOverlayPng(topText, bottomText, scene.type, overlayPath);
    overlays.push(overlayPath);
  }

  // ── Step 4: Composite with FFmpeg ───────────────────────────
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await runOverlay(videoPath, overlays, timings, outputPath);

  // ── Step 5: Verify output ──────────────────────────────────
  const stat = fs.statSync(outputPath);
  if (stat.size === 0) throw new Error('Caption overlay produced an empty file.');

  console.log(`[captioner] Final video: ${outputPath} (${(stat.size / 1024).toFixed(0)} KB)`);

  // ── Cleanup temp overlays ───────────────────────────────────
  for (const op of overlays) try { fs.unlinkSync(op); } catch {}
  try { fs.rmdirSync(tmpDir); } catch {}
}

// ── Timing calculation ──────────────────────────────────────────

function calculateTimings(sceneCount, duration) {
  // Opening: first 3s, Closing: last 3s, Features: middle portion
  const OPENING_DUR = Math.min(3, duration * 0.15);
  const CLOSING_DUR  = Math.min(3, duration * 0.15);
  const featureCount  = sceneCount - 2;
  const featureStart = OPENING_DUR;
  const featureEnd    = duration - CLOSING_DUR;
  const featureDur   = featureCount > 0 ? (featureEnd - featureStart) / featureCount : 0;

  const timings = [];

  for (let i = 0; i < sceneCount; i++) {
    let start, end;
    if (i === 0) {
      // Opening
      start = 0;
      end   = OPENING_DUR;
    } else if (i === sceneCount - 1) {
      // Closing
      start = duration - CLOSING_DUR;
      end   = duration;
    } else {
      // Feature scene
      const featIdx = i - 1;
      start = featureStart + featIdx * featureDur;
      end   = featureStart + (featIdx + 1) * featureDur;
    }
    timings.push({ start, end });
  }

  return timings;
}

// ── Video duration probe ─────────────────────────────────────────

function probeVideoDuration(videoPath) {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic;
  try {
    // ffmpeg -i without an output file exits with code 1 but
    // writes duration info to stderr
    execFileSync(ffmpegPath, ['-i', videoPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch (err) {
    const stderr = err.stderr?.toString() ?? '';
    const match  = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (match) {
      return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
    }
  }
  return 0;
}

// ── Overlay PNG generation with Sharp ────────────────────────────

async function renderOverlayPng(topText, bottomText, sceneType, outPath) {
  const svg = buildOverlaySvg(topText, bottomText, sceneType);
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outPath);
}

function buildOverlaySvg(topText, bottomText, sceneType) {
  const MAX_CHARS = 28;
  const LINE_H    = 68;

  const topLines    = topText    ? wrapText(topText, MAX_CHARS)    : [];
  const bottomLines = bottomText ? wrapText(bottomText, MAX_CHARS) : [];

  const parts = [];

  // ── Top gradient + text (opening scene only) ────────────────
  if (topLines.length > 0) {
    const topH = 80 + topLines.length * LINE_H + 40;
    parts.push(`
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#000000" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${OUT_W}" height="${topH}" fill="url(#tg)"/>
    `);

    const topFontSz = sceneType === 'opening' ? 56 : 48;
    topLines.forEach((line, idx) => {
      parts.push(`
        <text x="${OUT_W / 2}" y="${90 + idx * LINE_H}"
              font-family="sans-serif" font-size="${topFontSz}"
              font-weight="bold" fill="white" text-anchor="middle"
              paint-order="stroke" stroke="#000000" stroke-width="3" stroke-linejoin="round">
          ${esc(line)}
        </text>
      `);
    });
  }

  // ── Bottom gradient + text (all scenes) ──────────────────────
  if (bottomLines.length > 0) {
    const bottomH = 80 + bottomLines.length * LINE_H + 40;
    const bottomY = OUT_H - bottomH - 40;
    const isClosing = sceneType === 'closing';

    parts.push(`
      <defs>
        <linearGradient id="bg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stop-color="#000000" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${bottomY}" width="${OUT_W}" height="${bottomH}" fill="url(#bg)"/>
    `);

    const bottomFontSz = isClosing ? 48 : 44;
    const bottomColor   = isClosing ? '#FFD700' : 'white';
    const bottomWeight  = isClosing ? 'bold' : 'normal';
    const textY0        = OUT_H - (bottomLines.length - 1) * LINE_H - 80;

    bottomLines.forEach((line, idx) => {
      parts.push(`
        <text x="${OUT_W / 2}" y="${textY0 + idx * LINE_H}"
              font-family="sans-serif" font-size="${bottomFontSz}"
              font-weight="${bottomWeight}" fill="${bottomColor}"
              text-anchor="middle"
              paint-order="stroke" stroke="#000000" stroke-width="2" stroke-linejoin="round">
          ${esc(line)}
        </text>
      `);
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}">
  ${parts.join('\n')}
</svg>`;
}

// ── FFmpeg overlay execution ─────────────────────────────────────

function runOverlay(videoPath, overlayPaths, timings, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Input 0: the AI-generated video
    cmd.input(videoPath);

    // Inputs 1..N: overlay PNGs
    for (const op of overlayPaths) {
      cmd.input(op);
    }

    // Build filter_complex:
    // [0:v]scale=1080:1920[base];
    // [base][1:v]overlay=enable='between(t,0,3)'[v1];
    // [v1][2:v]overlay=enable='between(t,3,7.5)'[v2];
    // ...
    const filters = [];
    filters.push(`[0:v]scale=${OUT_W}:${OUT_H}[base]`);

    let prevLabel = 'base';
    for (let i = 0; i < overlayPaths.length; i++) {
      const { start, end } = timings[i];
      const outLabel = i === overlayPaths.length - 1 ? '[vout]' : `[v${i}]`;
      filters.push(
        `[${prevLabel}][${i + 1}:v]overlay=enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'${outLabel}`
      );
      prevLabel = outLabel.replace(/[[\]]/g, '');
    }

    cmd.complexFilter(filters.join(';'));

    // Map video output and optional audio
    cmd.outputOptions([
      '-map', '[vout]',
      '-map', '0:a?',  // optional audio (won't fail if no audio stream)
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '23',
      '-preset', 'fast',
      '-r', '30',
      '-s', `${OUT_W}x${OUT_H}`,
      '-movflags', '+faststart',
    ]);
    cmd.audioCodec('aac').audioBitrate('128k');

    cmd.output(outputPath);

    cmd
      .on('start',    (cli) => console.log('[captioner] start:', cli.slice(0, 100) + '…'))
      .on('progress', (p)  => process.stdout.write(`\r[captioner] ${p.timemark}`))
      .on('end', () => {
        process.stdout.write('\n');
        resolve();
      })
      .on('error', (err) => {
        process.stdout.write('\n');
        console.error('[captioner] error:', err.message);
        reject(new Error(`Caption overlay failed: ${err.message}`));
      })
      .run();
  });
}

// ── Helpers ──────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}
