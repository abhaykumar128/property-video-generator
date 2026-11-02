/**
 * create-sample-images.js
 * Generates 6 synthetic JPEG property images (1080×1920, 9:16) using Sharp.
 *
 * These are self-created gradient/colour-plate images with text labels —
 * no external images required, no licensing concerns.
 *
 * Output: samples/sample-images/01-exterior.jpg … 06-balcony.jpg
 *
 * Run:  node backend/scripts/create-sample-images.js
 */

import sharp from 'sharp';
import path   from 'path';
import fs     from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', '..', 'samples', 'sample-images');

const W = 1080;
const H = 1920;

// Scene definitions — colours and labels representing property photos
const SCENES = [
  { file: '01-exterior.jpg',   label: 'Exterior View',     c1: '#1a4a7a', c2: '#2d6b9e' },
  { file: '02-living-room.jpg', label: 'Living Room',      c1: '#6b5b3d', c2: '#9c8a5e' },
  { file: '03-kitchen.jpg',     label: 'Modern Kitchen',   c1: '#3d6b5b', c2: '#5e9c7a' },
  { file: '04-bedroom.jpg',     label: 'Master Bedroom',    c1: '#5b3d6b', c2: '#7a5e9c' },
  { file: '05-balcony.jpg',     label: 'Balcony View',     c1: '#1a5a4a', c2: '#2d8a6e' },
  { file: '06-parking.jpg',     label: 'Covered Parking',  c1: '#3d3d4a', c2: '#5e5e6e' },
];

function buildSceneSVG(scene) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${scene.c1}"/>
        <stop offset="100%" stop-color="${scene.c2}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>

    <!-- Decorative "window" frame -->
    <rect x="140" y="300" width="${W - 280}" height="900"
          fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6" rx="12"/>
    <line x1="${W/2}" y1="300" x2="${W/2}" y2="1200"
          stroke="rgba(255,255,255,0.10)" stroke-width="4"/>
    <line x1="140"  y1="750" x2="${W-140}" y2="750"
          stroke="rgba(255,255,255,0.10)" stroke-width="4"/>

    <!-- Floor suggestion -->
    <rect x="0" y="${H-400}" width="${W}" height="400" fill="rgba(0,0,0,0.18)"/>
    <line x1="0" y1="${H-400}" x2="${W}" y2="${H-400}" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

    <!-- Label -->
    <text x="${W/2}" y="${H-200}" font-family="sans-serif" font-size="72"
          fill="rgba(255,255,255,0.35)" text-anchor="middle" font-weight="bold">
      ${scene.label}
    </text>
  </svg>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Creating 6 synthetic sample images (1080×1920 JPEG)…\n');
  for (const scene of SCENES) {
    const outPath = path.join(OUT_DIR, scene.file);
    const svg     = buildSceneSVG(scene);
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(outPath);
    const stat = fs.statSync(outPath);
    console.log(`  ✓ ${scene.file}  (${(stat.size / 1024).toFixed(0)} KB)`);
  }
  console.log(`\nAll images saved to: ${OUT_DIR}`);
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
