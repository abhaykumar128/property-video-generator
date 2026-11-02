/**
 * frameRenderer.js
 * Prepares individual PNG frames for FFmpeg using Sharp.
 *
 * Output format:
 *   - 1080 × 1920 px  (9:16 vertical, optimised for mobile / reels)
 *   - PNG (lossless — FFmpeg re-encodes to H.264)
 *
 * Each frame is composited in three layers:
 *   1. Source image — resized to fill 1080 × 1920 with letterbox / pillarbox
 *      padding so proportions are never distorted.
 *   2. Gradient scrim — semi-transparent gradient behind the text for contrast.
 *   3. SVG text overlay — caption / headline / CTA, fully escaped.
 *
 * Font strategy:
 *   SVG generic families ("sans-serif") are used so Sharp's embedded librsvg
 *   resolver picks the best available system font.  No single-OS font is
 *   hard-coded.
 */

import sharp from 'sharp';
import path  from 'path';
import fs    from 'fs';
import os    from 'os';

// ── Canvas dimensions ────────────────────────────────────────────
export const FRAME_W = 1080;
export const FRAME_H = 1920;

// Background fill colour when padding is needed (dark neutral)
const PAD_COLOUR = { r: 15, g: 15, b: 20, alpha: 1 };

/**
 * Prepare one PNG frame per scene.
 *
 * @param {string[]} imagePaths   Absolute paths to uploaded images (in order)
 * @param {object[]} scenes       Script scenes [{sceneIndex, caption, type}]
 * @param {object}   script       Full script {openingTitle, callToAction, …}
 * @returns {Promise<string[]>}   Absolute paths to the generated PNG frames
 */
export async function buildFrames(imagePaths, scenes, script) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvg-'));
  const framePaths = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene    = scenes[i];
    const srcImage = imagePaths[Math.min(scene.sceneIndex, imagePaths.length - 1)];

    const topText    = scene.type === 'opening' ? script.openingTitle : '';
    const bottomText = scene.type === 'closing'  ? script.callToAction : scene.caption;

    const outPath = path.join(tmpDir, `frame-${String(i).padStart(3, '0')}.png`);
    await renderFrame(srcImage, topText, bottomText, scene.type, outPath);
    framePaths.push(outPath);
  }

  return framePaths;
}

// ── Single-frame renderer ────────────────────────────────────────

async function renderFrame(srcImage, topText, bottomText, sceneType, outPath) {
  // Step 1: resize source image to fit inside 1080×1920, pad with dark bg
  let baseBuffer;
  try {
    baseBuffer = await sharp(srcImage)
      .resize(FRAME_W, FRAME_H, {
        fit:        'contain',          // never crop or stretch
        position:   'centre',
        background: PAD_COLOUR,
      })
      .png()
      .toBuffer();
  } catch (err) {
    throw new Error(`Failed to process image "${path.basename(srcImage)}": ${err.message}`);
  }

  // Step 2: build SVG overlay
  const svgOverlay = buildSvgOverlay(topText, bottomText, sceneType);

  // Step 3: composite SVG onto the resized image
  await sharp(baseBuffer)
    .composite([{ input: Buffer.from(svgOverlay), gravity: 'centre' }])
    .png()
    .toFile(outPath);
}

// ── SVG overlay builder ──────────────────────────────────────────

/**
 * Returns an SVG string at FRAME_W × FRAME_H that draws:
 *   - A gradient scrim at the top (when topText is set)
 *   - A gradient scrim at the bottom (always)
 *   - Text elements with safe XML escaping
 *
 * Line wrapping: captions longer than MAX_CHARS_PER_LINE are split
 * into multiple <tspan> elements, each shifted down by LINE_HEIGHT px.
 */
function buildSvgOverlay(topText, bottomText, sceneType) {
  const MAX_CHARS = 28;   // ~28 chars fit at 52px on a 1080px canvas with margins
  const LINE_H    = 68;   // px between wrapped lines
  const MARGIN    = 60;   // px from left / right edge

  const topLines    = topText    ? wrapText(topText,    MAX_CHARS) : [];
  const bottomLines = bottomText ? wrapText(bottomText, MAX_CHARS) : [];

  // ── Top scrim (opening scene only) ──────────────────────────
  const topScrimH  = topLines.length > 0 ? 80 + topLines.length * LINE_H : 0;
  const topScrimSvg = topLines.length > 0 ? `
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${FRAME_W}" height="${topScrimH + 40}"
          fill="url(#tg)"/>
  ` : '';

  // ── Bottom scrim (all scenes) ────────────────────────────────
  const bottomScrimH = 80 + bottomLines.length * LINE_H;
  const bottomScrimSvg = `
    <defs>
      <linearGradient id="bg" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="${FRAME_H - bottomScrimH - 40}"
          width="${FRAME_W}" height="${bottomScrimH + 40}"
          fill="url(#bg)"/>
  `;

  // ── Top text lines ───────────────────────────────────────────
  const isOpening  = sceneType === 'opening';
  const topFontSz  = isOpening ? 60 : 52;
  const topY0      = 90;
  const topTextSvg = topLines.map((line, idx) => `
    <text x="${FRAME_W / 2}" y="${topY0 + idx * LINE_H}"
          font-family="sans-serif" font-size="${topFontSz}"
          font-weight="bold" fill="white"
          text-anchor="middle"
          paint-order="stroke"
          stroke="#000000" stroke-width="3" stroke-linejoin="round">
      ${esc(line)}
    </text>
  `).join('');

  // ── Bottom text lines ────────────────────────────────────────
  const isClosing     = sceneType === 'closing';
  const bottomFontSz  = isClosing ? 48 : 44;
  const bottomY0      = FRAME_H - (bottomLines.length - 1) * LINE_H - 80;
  const bottomTextSvg = bottomLines.map((line, idx) => `
    <text x="${FRAME_W / 2}" y="${bottomY0 + idx * LINE_H}"
          font-family="sans-serif" font-size="${bottomFontSz}"
          font-weight="${isClosing ? 'bold' : 'normal'}"
          fill="${isClosing ? '#FFD700' : 'white'}"
          text-anchor="middle"
          paint-order="stroke"
          stroke="#000000" stroke-width="2" stroke-linejoin="round">
      ${esc(line)}
    </text>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${FRAME_W}" height="${FRAME_H}">
  ${topScrimSvg}
  ${bottomScrimSvg}
  ${topTextSvg}
  ${bottomTextSvg}
</svg>`;
}

// ── Helpers ──────────────────────────────────────────────────────

/** XML-safe escaping — prevents SVG injection from property data. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Wrap a string into lines of at most maxChars characters,
 * breaking on word boundaries where possible.
 */
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
      // If a single word is too long, hard-break it
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
