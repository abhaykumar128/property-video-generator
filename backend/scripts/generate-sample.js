/**
 * generate-sample.js
 * Generates a real sample promotional MP4 from the synthetic sample data
 * and sample images in the /samples directory.
 *
 * Reads:
 *   samples/sample-property.json
 *   samples/sample-images/*.jpg
 *
 * Writes:
 *   samples/output/sample-property-video.mp4
 *
 * Run:  node backend/scripts/generate-sample.js
 *       node backend/scripts/generate-sample.js --output ./custom.mp4
 */

import 'dotenv/config';
import path   from 'path';
import fs     from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..', '..');
const SAMPLES   = path.join(ROOT, 'samples');

// ── Parse CLI args ───────────────────────────────────────────────
const outputArgIdx = process.argv.indexOf('--output');
const outputPath   = outputArgIdx !== -1
  ? path.resolve(process.argv[outputArgIdx + 1])
  : path.join(SAMPLES, 'output', 'sample-property-video.mp4');

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' PropertyStudio AI — Sample MP4 Generator');
  console.log('═══════════════════════════════════════════════════\n');

  // ── Step 0: Load sample data ───────────────────────────────────
  console.log('Step 0/4  Loading sample data…');
  const propertyPath = path.join(SAMPLES, 'sample-property.json');
  const imagesDir    = path.join(SAMPLES, 'sample-images');

  if (!fs.existsSync(propertyPath)) {
    throw new Error(`Sample property file not found: ${propertyPath}`);
  }
  const property = JSON.parse(fs.readFileSync(propertyPath, 'utf-8'));
  // Remove the _comment field — not part of the schema
  delete property._comment;
  console.log(`  Property: ${property.propertyName}, ${property.location}`);
  console.log(`  Features: ${property.features.join(', ')}`);

  // Load image files (sorted by filename)
  const imageFiles = fs.readdirSync(imagesDir)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(imagesDir, f));

  if (imageFiles.length < 4) {
    throw new Error(`Need at least 4 sample images. Found ${imageFiles.length} in ${imagesDir}`);
  }
  console.log(`  Images:   ${imageFiles.length} files found`);
  imageFiles.forEach((f, i) => console.log(`    ${i + 1}. ${path.basename(f)}`));

  // ── Step 1: Generate script (template — no API key needed) ───
  console.log('\nStep 1/4  Generating promotional script (template mode)…');
  const { buildTemplateScript } = await import('../src/services/template.service.js');
  const script = buildTemplateScript(property, imageFiles.length);
  console.log(`  Opening title : "${script.openingTitle}"`);
  console.log(`  Voice-over    : "${script.voiceOver.slice(0, 80)}…"`);
  console.log(`  Scenes        : ${script.scenes.length}`);
  console.log(`  Call to action: "${script.callToAction}"`);

  // ── Step 2: Build frames ─────────────────────────────────────
  console.log('\nStep 2/4  Building frames with text overlays (Sharp)…');
  const { buildFrames } = await import('../src/utils/frameRenderer.js');
  const framePaths      = await buildFrames(imageFiles, script.scenes, script);
  console.log(`  ✓ ${framePaths.length} frames built`);

  // ── Step 3: Render MP4 ───────────────────────────────────────
  console.log('\nStep 3/4  Rendering MP4 with FFmpeg…');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const { renderMp4, computeTotalDuration } = await import('../src/utils/ffmpegRenderer.js');
  await renderMp4(framePaths, outputPath);

  // ── Step 4: Verify ────────────────────────────────────────────
  const stat = fs.statSync(outputPath);
  const kb   = (stat.size / 1024).toFixed(0);
  const dur  = computeTotalDuration(framePaths.length).toFixed(1);

  console.log('\nStep 4/4  Verifying output…');

  // Probe with FFmpeg to verify format
  const ffmpegPath = (await import('ffmpeg-static')).default;
  const { execFileSync } = await import('child_process');
  let probeInfo = '';
  try {
    const probeOut = execFileSync(ffmpegPath, ['-i', outputPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    probeInfo = probeOut;
  } catch (err) {
    // FFmpeg writes to stderr — capture it
    probeInfo = err.stderr?.toString() ?? '';
  }

  // Extract duration, resolution, codec from probe output
  const durMatch   = probeInfo.match(/Duration:\s*([\d:.]+)/);
  const resMatch  = probeInfo.match(/,\s*(\d{3,4})x(\d{3,4})/);
  const codecMatch = probeInfo.match(/Video:\s*(\w+)/);
  const fpsMatch   = probeInfo.match(/(\d+)\s*fps/);

  const duration  = durMatch  ? durMatch[1]  : 'unknown';
  const width     = resMatch  ? resMatch[1]  : 'unknown';
  const height    = resMatch  ? resMatch[2]  : 'unknown';
  const codec     = codecMatch ? codecMatch[1] : 'unknown';
  const fps       = fpsMatch  ? fpsMatch[1]  : 'unknown';

  console.log(`  File      : ${outputPath}`);
  console.log(`  Size      : ${kb} KB`);
  console.log(`  Codec     : ${codec}`);
  console.log(`  Resolution: ${width}×${height}`);
  console.log(`  FPS       : ${fps}`);
  console.log(`  Duration  : ${duration} (target ~${dur}s)`);

  // Validate
  if (stat.size === 0) throw new Error('Output file is empty!');
  if (codec !== 'h264') throw new Error(`Expected H.264 codec, got ${codec}`);
  if (width !== '1080' || height !== '1920') throw new Error(`Expected 1080×1920, got ${width}×${height}`);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  ✅  Sample MP4 generated and verified!         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Codec : ${String(codec).padEnd(44)} ║`);
  console.log(`║  Size  : ${String(width + '×' + height).padEnd(44)} ║`);
  console.log(`║  FPS   : ${String(fps).padEnd(44)} ║`);
  console.log(`║  Length: ${String(duration + ' (' + kb + ' KB)').padEnd(44)} ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Cleanup temp frames ──────────────────────────────────────
  for (const fp of framePaths) {
    try { fs.unlinkSync(fp); } catch { /* best-effort */ }
  }
  if (framePaths.length > 0) {
    try { fs.rmdirSync(path.dirname(framePaths[0])); } catch { /* best-effort */ }
  }
}

main().catch((err) => {
  console.error('\n❌ Sample generation failed:', err.message);
  process.exit(1);
});
