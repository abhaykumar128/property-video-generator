/**
 * generate-mohali-luxury.js
 * ──────────────────────────────────────────────────────────────────────
 * Generates a 30-40 second promotional MP4 for "Mohali Luxury Residency"
 * using the AVIF images in samples/sample-images/.
 *
 * Matches the Gemini sample video format exactly:
 *   1280×720, 24fps, H.264, AAC audio, landscape (16:9)
 *
 * Pipeline
 * ─────────
 *  1. Convert every AVIF → PNG (Sharp, resized to 1280×720)
 *  2. Analyse each image with Gemini 2.0 Flash → room label + caption
 *  3. Build a 30-40 second voiceover script with Gemini
 *  4. Synthesise WAV with Gemini 3.8 Flash TTS (deep, clear narrator voice)
 *  5. Render one 1280×720 PNG frame per image with text overlays (Sharp)
 *  6. Assemble MP4 with xfade transitions + TTS audio (FFmpeg)
 *  7. Verify output and print final report
 *
 * Output → samples/output/mohali-luxury-residency.mp4
 *
 * Usage
 * ──────
 *   node backend/scripts/generate-mohali-luxury.js
 *   node backend/scripts/generate-mohali-luxury.js --output ./my.mp4
 */

import path      from 'path';
import fs        from 'fs';
import os        from 'os';
import { fileURLToPath } from 'url';
import { execFileSync }  from 'child_process';

// Load .env from backend/ — works no matter what cwd is
const __file    = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__file);
const envFile   = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: envFile });
}

import sharp            from 'sharp';
import ffmpegStatic     from 'ffmpeg-static';
import ffmpeg           from 'fluent-ffmpeg';
import { GoogleGenAI }           from '@google/genai';
import { GoogleGenerativeAI }    from '@google/generative-ai';

// ── Paths ─────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, '..', '..');
const SAMPLES     = path.join(ROOT, 'samples');
const IMAGES_DIR  = path.join(SAMPLES, 'sample-images');

const outputArgIdx = process.argv.indexOf('--output');
const OUTPUT_PATH  = outputArgIdx !== -1
  ? path.resolve(process.argv[outputArgIdx + 1])
  : path.join(SAMPLES, 'output', 'mohali-luxury-residency.mp4');

// ── FFmpeg ────────────────────────────────────────────────────────
const FFMPEG_BIN = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
ffmpeg.setFfmpegPath(FFMPEG_BIN);

// ── Video constants — matches Gemini sample video exactly ─────────
const FRAME_W         = 1280;
const FRAME_H         = 720;
const SECONDS_PER_IMG = 4;
const FADE_DURATION   = 0.5;
const FPS             = 24;
const PAD_COLOUR      = { r: 8, g: 8, b: 16, alpha: 1 };

// ── Property data ─────────────────────────────────────────────────
const PROPERTY = {
  propertyName: 'Mohali Luxury Residency',
  location:     'Mohali, Punjab',
  price:        '₹1.25 Crore onwards',
  propertyType: 'Premium Residential Apartments',
  agentName:    'Rahul Arora',
  agentPhone:   '+91 98140 55555',
};

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  banner('Mohali Luxury Residency — AI Video Generator');

  // ── Step 0: Find images ──────────────────────────────────────
  step(0, 'Scanning sample-images directory…');
  const allFiles   = fs.readdirSync(IMAGES_DIR).sort();
  const imageFiles = allFiles.filter(f =>
    /\.(avif|jpg|jpeg|png|webp)$/i.test(f) && !f.endsWith('.md')
  );
  if (imageFiles.length < 1) throw new Error(`No images found in ${IMAGES_DIR}`);
  console.log(`  Found ${imageFiles.length} image(s)`);
  imageFiles.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mohali-'));

  try {
    // ── Step 1: Convert to 1280×720 PNG ─────────────────────────
    step(1, 'Converting images to 1280×720 PNG (Sharp)…');
    const pngPaths = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const src  = path.join(IMAGES_DIR, imageFiles[i]);
      const dest = path.join(tmpDir, `img-${String(i).padStart(3, '0')}.png`);
      await sharp(src)
        .resize(FRAME_W, FRAME_H, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(dest);
      console.log(`  ✓ ${imageFiles[i]}`);
      pngPaths.push(dest);
    }

    // ── Step 2: AI Vision — identify rooms ──────────────────────
    step(2, 'Identifying rooms with Gemini Vision…');
    const roomLabels = await analyseImages(pngPaths);
    roomLabels.forEach((r, i) =>
      console.log(`  Image ${i + 1}: [${r.label}] "${r.caption}"`)
    );

    // ── Step 3: Generate voiceover script ────────────────────────
    step(3, 'Writing promotional voiceover script…');
    const script = await generateScript(roomLabels);
    console.log(`  Opening : "${script.openingLine}"`);
    console.log(`  Voice   : "${script.voiceOver.slice(0, 90)}…"`);
    console.log(`  Closing : "${script.closingLine}"`);

    // ── Step 4: Synthesise TTS audio ─────────────────────────────
    step(4, 'Synthesising narration with Gemini TTS…');
    const audioPath = await synthesiseAudio(script.voiceOver, tmpDir);
    if (audioPath) {
      const kb = (fs.statSync(audioPath).size / 1024).toFixed(0);
      console.log(`  ✓ Voiceover WAV: ${kb} KB`);
    } else {
      console.log('  ⚠ TTS unavailable — video will be silent');
    }

    // ── Step 5: Build frames ─────────────────────────────────────
    step(5, 'Building 1280×720 frames with text overlays (Sharp)…');
    const framePaths = await buildAllFrames(pngPaths, roomLabels, script, tmpDir);
    console.log(`  ✓ ${framePaths.length} frames rendered`);

    // ── Step 6: Render MP4 ───────────────────────────────────────
    step(6, 'Assembling MP4 with FFmpeg xfade + audio…');
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    await renderMp4(framePaths, OUTPUT_PATH, audioPath);

    // ── Step 7: Verify ───────────────────────────────────────────
    step(7, 'Verifying output…');
    const stat  = fs.statSync(OUTPUT_PATH);
    const probe = probeVideo(OUTPUT_PATH);
    printReport(probe, stat.size, OUTPUT_PATH);

  } finally {
    // Always clean up temp directory
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    console.log('  🗑  Temp files cleaned up.\n');
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 2 — Gemini Vision: identify each room
// ─────────────────────────────────────────────────────────────────

async function analyseImages(pngPaths) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('  ⚠ No GEMINI_API_KEY — using smart positional labels');
    return buildPositionalLabels(pngPaths.length);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const results = [];

  for (let i = 0; i < pngPaths.length; i++) {
    const imgBuf = fs.readFileSync(pngPaths[i]);
    const b64    = imgBuf.toString('base64');

    const prompt =
      'Look at this real estate property photo carefully.\n' +
      'Identify EXACTLY what room or area is shown. Be precise — distinguish between:\n' +
      '"Living Room", "Kitchen", "Bedroom", "Bathroom", "Balcony",\n' +
      '"Dining Area", "Study Room", "Exterior / Building Facade",\n' +
      '"Swimming Pool", "Garden / Outdoor", "Lobby / Entrance", "Parking".\n\n' +
      'Return ONLY valid JSON (no markdown), with these exact fields:\n' +
      '{\n' +
      '  "label": "<room name, max 22 chars>",\n' +
      '  "caption": "<one vivid sentence about what you see, max 58 chars>"\n' +
      '}';

    try {
      const resp = await model.generateContent([
        prompt,
        { inlineData: { mimeType: 'image/png', data: b64 } },
      ]);
      const raw = resp.response.text().trim()
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```\s*$/im, '')
        .trim();
      const parsed = JSON.parse(raw);
      results.push({
        label:   String(parsed.label   || `Room ${i + 1}`).slice(0, 22),
        caption: String(parsed.caption || `Scene ${i + 1}`).slice(0, 58),
      });
    } catch (err) {
      console.warn(`  ⚠ Vision API failed for image ${i + 1}: ${err.message.slice(0, 70)}`);
      results.push(buildPositionalLabels(1, i)[0]);
    }

    if (i < pngPaths.length - 1) await sleep(300);
  }

  return results;
}

function buildPositionalLabels(count, offset = 0) {
  const bank = [
    { label: 'Exterior / Building',  caption: 'Grand facade of the luxury residency'         },
    { label: 'Living Room',          caption: 'Spacious living area with modern interiors'    },
    { label: 'Kitchen',              caption: 'Fully equipped modular kitchen'                },
    { label: 'Master Bedroom',       caption: 'Elegant master bedroom with walk-in wardrobe'  },
    { label: 'Bathroom',             caption: 'Designer bathroom with premium fittings'       },
    { label: 'Balcony',              caption: 'Private balcony with panoramic city views'     },
    { label: 'Dining Area',          caption: 'Stylish dining space for family moments'       },
    { label: 'Bedroom',              caption: 'Cosy secondary bedroom with ample light'       },
    { label: 'Garden / Outdoor',     caption: 'Lush landscaped gardens and open spaces'       },
  ];
  return Array.from({ length: count }, (_, i) => bank[(i + offset) % bank.length]);
}

// ─────────────────────────────────────────────────────────────────
// STEP 3 — Generate voiceover script
// ─────────────────────────────────────────────────────────────────

async function generateScript(roomLabels) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return buildFallbackScript(roomLabels);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });

  const scenes = roomLabels.map((r, i) =>
    `  Scene ${i + 1} (${i === 0 ? 'opening' : i === roomLabels.length - 1 ? 'closing' : 'feature'}): ${r.label} — ${r.caption}`
  ).join('\n');

  const prompt = `You are writing a warm, professional real-estate video narrator script.

Property: ${PROPERTY.propertyName}
Location: ${PROPERTY.location}
Price: ${PROPERTY.price}
Type: ${PROPERTY.propertyType}
Contact: ${PROPERTY.agentName}, ${PROPERTY.agentPhone}

Video scenes:
${scenes}

RULES:
1. Use ONLY the facts provided above — no invented amenities.
2. The voiceOver must be exactly 80-100 words so it fills a 30-35 second video nicely.
3. Mention each major room/feature visible in the scenes naturally.
4. Warm, confident, inviting tone — like a trusted real estate narrator.
5. Start with the property name and location.
6. End with price and a call-to-action including the phone number.
7. Return ONLY valid JSON — no markdown, no extra text.

JSON shape:
{
  "openingLine": "<property name + location headline, max 12 words>",
  "voiceOver": "<80-100 word narration>",
  "closingLine": "<price + CTA, max 14 words>"
}`;

  try {
    const resp = await model.generateContent(prompt);
    const raw  = resp.response.text().trim()
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();
    const p = JSON.parse(raw);
    return {
      openingLine: String(p.openingLine || PROPERTY.propertyName).slice(0, 65),
      voiceOver:   String(p.voiceOver   || buildFallbackScript(roomLabels).voiceOver),
      closingLine: String(p.closingLine || `Priced from ${PROPERTY.price}`).slice(0, 70),
    };
  } catch (err) {
    console.warn(`  ⚠ Script generation failed: ${err.message.slice(0, 80)}`);
    return buildFallbackScript(roomLabels);
  }
}

function buildFallbackScript(roomLabels) {
  const rooms = roomLabels
    .slice(1, -1)
    .map(r => r.label.toLowerCase())
    .filter((v, i, a) => a.indexOf(v) === i)  // deduplicate
    .slice(0, 5)
    .join(', ');

  const voiceOver =
    `Welcome to ${PROPERTY.propertyName}, a stunning collection of premium residential apartments ` +
    `nestled in the heart of ${PROPERTY.location}. ` +
    `Explore beautifully designed spaces including ${rooms}. ` +
    `Every corner is crafted with luxury finishes, modern amenities, and attention to detail ` +
    `that sets this community apart. ` +
    `Homes are available from ${PROPERTY.price}. ` +
    `Call ${PROPERTY.agentName} at ${PROPERTY.agentPhone} to book your exclusive site visit today.`;

  return {
    openingLine: `Welcome to ${PROPERTY.propertyName} · ${PROPERTY.location}`,
    voiceOver,
    closingLine: `From ${PROPERTY.price} · Call ${PROPERTY.agentPhone}`,
  };
}

// ─────────────────────────────────────────────────────────────────
// STEP 4 — Gemini TTS narration
// ─────────────────────────────────────────────────────────────────

async function synthesiseAudio(voiceOverText, tmpDir) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    console.log('  Calling Gemini 3.8 Flash TTS…');

    const interaction = await ai.interactions.create({
      model: 'gemini-3.8-flash-tts',
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text: voiceOverText,
          annotations: [{
            type:  'speech_metadata',
            style: 'warm, professional, smooth real estate narrator, clear diction, moderate pace, confident and inviting',
          }],
        }],
      }],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice: 'Charon' }],  // deep, professional voice
      },
    });

    if (!interaction.output_audio?.data) {
      throw new Error('No audio data in TTS response');
    }

    const wavPath = path.join(tmpDir, 'voiceover.wav');
    fs.writeFileSync(wavPath, Buffer.from(interaction.output_audio.data, 'base64'));
    return wavPath;

  } catch (err) {
    // Try Kore voice as fallback
    try {
      console.warn(`  Charon failed (${err.message.slice(0, 60)}), trying Kore voice…`);
      const ai = new GoogleGenAI({ apiKey });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash-tts',
        input: [{
          type: 'user_input',
          content: [{
            type: 'text',
            text: voiceOverText,
            annotations: [{
              type:  'speech_metadata',
              style: 'professional, clear, warm narrator',
            }],
          }],
        }],
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: 'Kore' }],
        },
      });
      if (!interaction.output_audio?.data) throw new Error('No audio data');
      const wavPath = path.join(tmpDir, 'voiceover.wav');
      fs.writeFileSync(wavPath, Buffer.from(interaction.output_audio.data, 'base64'));
      return wavPath;
    } catch (err2) {
      console.warn(`  ⚠ TTS failed: ${err2.message.slice(0, 100)}`);
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 5 — Build PNG frames with text overlays
// ─────────────────────────────────────────────────────────────────

async function buildAllFrames(pngPaths, roomLabels, script, tmpDir) {
  const frameDir = path.join(tmpDir, 'frames');
  fs.mkdirSync(frameDir, { recursive: true });

  const n     = pngPaths.length;
  const paths = [];

  for (let i = 0; i < n; i++) {
    const isOpening = i === 0;
    const isClosing = i === n - 1;
    const sceneType = isOpening ? 'opening' : isClosing ? 'closing' : 'feature';

    // Only show top text on the opening frame — feature labels were wrong so removed
    const topText    = isOpening ? script.openingLine : '';
    const bottomText = isClosing ? script.closingLine : roomLabels[i].caption;

    const outPath = path.join(frameDir, `frame-${String(i).padStart(3, '0')}.png`);
    await compositeFrame(pngPaths[i], topText, bottomText, sceneType, outPath);

    const marker = isOpening ? '🎬' : isClosing ? '🏁' : '📸';
    console.log(`  ${marker} Frame ${i + 1}/${n} [${sceneType}]: ${topText || bottomText}`);
    paths.push(outPath);
  }
  return paths;
}

async function compositeFrame(srcPng, topText, bottomText, sceneType, outPath) {
  const svg = buildSvg(topText, bottomText, sceneType);
  await sharp(srcPng)
    .composite([{ input: Buffer.from(svg), gravity: 'centre' }])
    .png()
    .toFile(outPath);
}

// ─────────────────────────────────────────────────────────────────
// SVG overlay — clean, modern real-estate style
// ─────────────────────────────────────────────────────────────────

function buildSvg(topText, bottomText, sceneType) {
  // Wrap text to fit 1280px wide canvas
  const MAX_TOP    = sceneType === 'opening' ? 22 : 18;
  const MAX_BOTTOM = 36;
  const LINE_H_TOP = sceneType === 'opening' ? 52 : 44;
  const LINE_H_BOT = 40;
  const MARGIN_X   = 48;

  const topLines    = topText    ? wrapText(topText,    MAX_TOP)    : [];
  const bottomLines = bottomText ? wrapText(bottomText, MAX_BOTTOM) : [];

  const isOpening = sceneType === 'opening';
  const isClosing = sceneType === 'closing';

  // ── Top gradient height ──────────────────────────────────────
  const topScrimH = topLines.length > 0 ? 30 + topLines.length * LINE_H_TOP + 30 : 0;

  // ── Bottom gradient height ───────────────────────────────────
  const botScrimH = bottomLines.length > 0 ? 24 + bottomLines.length * LINE_H_BOT + 30 : 0;

  // ── Property watermark on non-opening frames ─────────────────
  const showBadge = !isOpening;

  const parts = [];

  // Top gradient
  if (topLines.length > 0) {
    parts.push(`
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#000000" stop-opacity="${isOpening ? 0.85 : 0.70}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${FRAME_W}" height="${topScrimH + 20}" fill="url(#tg)"/>
    `);
  }

  // Bottom gradient
  if (bottomLines.length > 0) {
    const yStart = FRAME_H - botScrimH - 20;
    parts.push(`
      <defs>
        <linearGradient id="bg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stop-color="#000000" stop-opacity="${isClosing ? 0.88 : 0.70}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${yStart}" width="${FRAME_W}" height="${botScrimH + 20}" fill="url(#bg)"/>
    `);
  }

  // Top text
  if (topLines.length > 0) {
    const fontSize = isOpening ? 48 : 38;
    const color    = isOpening ? '#FFD700' : '#FFFFFF';
    const weight   = isOpening ? 'bold' : '600';
    topLines.forEach((line, idx) => {
      const y = 44 + idx * LINE_H_TOP;
      parts.push(`
        <text x="${FRAME_W / 2}" y="${y}"
              font-family="Georgia, 'Times New Roman', serif"
              font-size="${fontSize}" font-weight="${weight}"
              fill="${color}" text-anchor="middle"
              paint-order="stroke"
              stroke="#000000" stroke-width="3" stroke-linejoin="round">
          ${esc(line)}
        </text>
      `);
    });

    // Decorative gold line under opening title
    if (isOpening) {
      const lineY = 44 + topLines.length * LINE_H_TOP + 8;
      parts.push(`
        <line x1="${FRAME_W / 2 - 120}" y1="${lineY}"
              x2="${FRAME_W / 2 + 120}" y2="${lineY}"
              stroke="#FFD700" stroke-width="2" opacity="0.85"/>
      `);
    }
  }

  // Bottom text
  if (bottomLines.length > 0) {
    const fontSize = isClosing ? 36 : 30;
    const color    = isClosing ? '#FFD700' : '#F0F0F0';
    const weight   = isClosing ? 'bold' : 'normal';
    const totalH   = bottomLines.length * LINE_H_BOT;
    const y0       = FRAME_H - totalH - 28;

    bottomLines.forEach((line, idx) => {
      const y = y0 + idx * LINE_H_BOT;
      parts.push(`
        <text x="${FRAME_W / 2}" y="${y}"
              font-family="Georgia, 'Times New Roman', serif"
              font-size="${fontSize}" font-weight="${weight}"
              fill="${color}" text-anchor="middle"
              paint-order="stroke"
              stroke="#000000" stroke-width="2" stroke-linejoin="round">
          ${esc(line)}
        </text>
      `);
    });
  }

  // Property name badge — bottom-left, non-opening frames
  if (showBadge) {
    const bText  = PROPERTY.propertyName;
    const bFontSz = 18;
    const bX     = MARGIN_X;
    const bY     = FRAME_H - 22;
    const bW     = bText.length * 10 + 20;
    parts.push(`
      <rect x="${bX - 8}" y="${bY - bFontSz - 4}" width="${bW}" height="${bFontSz + 10}"
            fill="#B8860B" rx="4" opacity="0.82"/>
      <text x="${bX}" y="${bY - 5}"
            font-family="sans-serif" font-size="${bFontSz}"
            font-weight="bold" fill="white" text-anchor="start">
        ${esc(bText)}
      </text>
    `);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_W}" height="${FRAME_H}">
  ${parts.join('\n')}
</svg>`;
}

// ─────────────────────────────────────────────────────────────────
// STEP 6 — Render MP4 with FFmpeg
// ─────────────────────────────────────────────────────────────────

function renderMp4(framePaths, outputPath, audioPath) {
  return new Promise((resolve, reject) => {
    const n   = framePaths.length;
    const cmd = ffmpeg();

    // Each frame as a still-image input
    for (const fp of framePaths) {
      cmd.input(fp)
         .inputOptions(['-loop 1', `-t ${SECONDS_PER_IMG}`, `-framerate ${FPS}`]);
    }

    // Optional TTS audio
    const hasAudio = Boolean(audioPath && fs.existsSync(audioPath));
    if (hasAudio) {
      cmd.input(audioPath);
      console.log('  🔊 Audio: voiceover WAV attached');
    } else {
      console.log('  🔇 Audio: none (silent video)');
    }

    // xfade filter chain
    const { filterStr, finalLabel } = buildXfadeFilter(n);
    const totalDuration = n * SECONDS_PER_IMG - Math.max(0, n - 1) * FADE_DURATION;

    let allFilters = filterStr;
    if (hasAudio) {
      // Trim audio to video length, slight volume boost
      const audioFilter =
        `[${n}:a]` +
        `aloop=loop=-1:size=2e+09,` +
        `atrim=duration=${totalDuration},` +
        `volume=1.0` +
        `[aout]`;
      allFilters = `${filterStr};${audioFilter}`;
    }

    cmd.complexFilter(allFilters);
    cmd.outputOptions(['-map', finalLabel]);
    if (hasAudio) cmd.outputOptions(['-map', '[aout]']);

    // Codec — match sample video: H.264, yuv420p, 24fps, 1280x720
    cmd.videoCodec('libx264')
       .outputOptions([
         '-pix_fmt yuv420p',
         '-crf 22',
         '-preset fast',
         `-r ${FPS}`,
         `-s ${FRAME_W}x${FRAME_H}`,
         '-movflags +faststart',
       ]);

    if (hasAudio) {
      cmd.audioCodec('aac')
         .audioBitrate('128k')
         .audioFrequency(48000)
         .audioChannels(2);
    } else {
      cmd.outputOptions(['-an']);
    }

    cmd.output(outputPath);

    cmd
      .on('start',    ()    => console.log('  ▶ FFmpeg started…'))
      .on('progress', (p)   => {
        const val = p.percent != null ? `${Math.round(p.percent)}%` : p.timemark;
        process.stdout.write(`\r  Rendering… ${val}     `);
      })
      .on('end', () => {
        process.stdout.write('\n');
        const st = fs.statSync(outputPath);
        if (st.size === 0) return reject(new Error('FFmpeg output is empty.'));
        resolve();
      })
      .on('error', (err, _out, stderr) => {
        process.stdout.write('\n');
        console.error('  ❌ FFmpeg error:', err.message);
        if (stderr) console.error('  stderr (tail):\n', stderr.slice(-500));
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .run();
  });
}

function buildXfadeFilter(n) {
  if (n === 1) return { filterStr: '[0:v]copy[vout]', finalLabel: '[vout]' };
  const parts = [];
  let prev    = '[0:v]';
  for (let i = 1; i < n; i++) {
    const offset   = i * SECONDS_PER_IMG - i * FADE_DURATION;
    const outLabel = i === n - 1 ? '[vout]' : `[v${i}]`;
    parts.push(
      `${prev}[${i}:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset.toFixed(3)}${outLabel}`
    );
    prev = outLabel;
  }
  return { filterStr: parts.join(';'), finalLabel: '[vout]' };
}

// ─────────────────────────────────────────────────────────────────
// STEP 7 — Probe and report
// ─────────────────────────────────────────────────────────────────

function probeVideo(videoPath) {
  let stderr = '';
  try {
    execFileSync(FFMPEG_BIN, ['-i', videoPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
  } catch (err) {
    stderr = err.stderr?.toString() ?? '';
  }
  return {
    duration: (stderr.match(/Duration:\s*([\d:.]+)/)    || [])[1] || 'unknown',
    width:    (stderr.match(/,\s*(\d{3,4})x(\d{3,4})/) || [])[1] || 'unknown',
    height:   (stderr.match(/,\s*(\d{3,4})x(\d{3,4})/) || [])[2] || 'unknown',
    codec:    (stderr.match(/Video:\s*(\w+)/)            || [])[1] || 'unknown',
    fps:      (stderr.match(/(\d+)\s*fps/)               || [])[1] || 'unknown',
    hasAudio: stderr.includes('Audio:'),
  };
}

function printReport(p, fileSize, outputPath) {
  const kb = (fileSize / 1024).toFixed(0);
  const mb = (fileSize / (1024 * 1024)).toFixed(2);
  const ok = p.codec === 'h264';

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║         MOHALI LUXURY RESIDENCY — VIDEO COMPLETE         ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  ${ok ? '✅' : '⚠'} Codec      : ${pad(p.codec, 48)} ║`);
  console.log(`║  ✅ Resolution : ${pad(p.width + '×' + p.height, 48)} ║`);
  console.log(`║  ✅ Frame rate : ${pad(p.fps + ' fps', 48)} ║`);
  console.log(`║  ✅ Duration   : ${pad(p.duration, 48)} ║`);
  console.log(`║  ${p.hasAudio ? '✅' : '⚠ '} Audio      : ${pad(p.hasAudio ? 'Yes — AI TTS voiceover (Gemini)' : 'No (silent)', 48)} ║`);
  console.log(`║  ✅ File size  : ${pad(kb + ' KB  (' + mb + ' MB)', 48)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  📁 Output    : ${pad(path.relative(ROOT, outputPath), 48)} ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (!ok) throw new Error(`Expected H.264 codec, got: ${p.codec}`);
}

// ─────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────

function wrapText(text, maxChars) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= maxChars) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      if (word.length > maxChars) {
        let rem = word;
        while (rem.length > maxChars) { lines.push(rem.slice(0, maxChars)); rem = rem.slice(maxChars); }
        cur = rem;
      } else {
        cur = word;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(str, len) { return String(str).padEnd(len).slice(0, len); }

function banner(title) {
  const line = '═'.repeat(60);
  console.log(`\n╔${line}╗`);
  console.log(`║  ${title.slice(0, 56).padEnd(56)}  ║`);
  console.log(`╚${line}╝\n`);
}

function step(n, msg) {
  console.log(`\n── Step ${n}/7  ${msg}`);
}

// ─────────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('\n❌ Failed:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
