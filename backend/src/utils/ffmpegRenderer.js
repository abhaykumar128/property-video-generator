/**
 * ffmpegRenderer.js
 * Assembles Sharp-prepared PNG frames into a real H.264 MP4 using FFmpeg.
 *
 * Uses ffmpeg-static so no system FFmpeg installation is required.
 * Falls back to FFMPEG_PATH env var or system PATH if the package binary
 * is unavailable.
 *
 * Output specification:
 *   - Container : MP4 (moov atom at start for fast web streaming)
 *   - Video     : H.264, yuv420p, 30 fps, 1080×1920
 *   - Audio     : AAC 128 kbps when an audio file is supplied; silent otherwise
 *   - Duration  : 4 s per scene → 8 scenes = 32 s (within 20–40 s target)
 *   - Transitions: 0.5 s crossfade between consecutive frames via xfade filter
 *
 * The function verifies the output file exists and is non-empty before resolving.
 */

import ffmpegStatic  from 'ffmpeg-static';
import ffmpeg        from 'fluent-ffmpeg';
import fs            from 'fs';
import path          from 'path';

// ── Configure FFmpeg binary ──────────────────────────────────────
// Priority: FFMPEG_PATH env → ffmpeg-static bundled binary → system PATH
const ffmpegBin = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';
ffmpeg.setFfmpegPath(ffmpegBin);

export const SECONDS_PER_SCENE = 4;   // each image is shown for 4 seconds
export const FADE_DURATION     = 0.5; // crossfade overlap in seconds
export const FPS               = 30;

/**
 * Render an MP4 from a list of PNG frame paths.
 *
 * @param {string[]} framePaths   Absolute paths to the prepared PNG frames
 * @param {string}   outputPath   Destination .mp4 file path
 * @param {string}   [audioPath]  Optional audio file path (MP3, WAV, AAC)
 * @returns {Promise<void>}       Resolves when the MP4 is verified on disk
 */
export function renderMp4(framePaths, outputPath, audioPath) {
  if (!framePaths || framePaths.length === 0) {
    return Promise.reject(new Error('renderMp4: no frames supplied.'));
  }

  // Verify all input frames exist before starting FFmpeg
  for (const fp of framePaths) {
    if (!fs.existsSync(fp)) {
      return Promise.reject(new Error(`Frame not found: ${fp}`));
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // ── Add each frame as a still-image input ────────────────
    // -loop 1        : treat the single image as an infinite loop
    // -t <seconds>   : read only SECONDS_PER_SCENE seconds from it
    // -framerate 30  : decode at 30 fps to produce smooth output
    for (const fp of framePaths) {
      cmd.input(fp)
         .inputOptions(['-loop 1', `-t ${SECONDS_PER_SCENE}`, `-framerate ${FPS}`]);
    }

    // ── Optional audio input ─────────────────────────────────
    const hasAudio = audioPath && fs.existsSync(audioPath);
    if (hasAudio) {
      cmd.input(audioPath);
    }

    // ── Video filter: chain xfade between consecutive frames ─
    const { filterStr, finalLabel } = buildXfadeFilter(framePaths.length);

    // ── Audio filter: trim/loop audio to match video duration ─
    const totalDuration = computeTotalDuration(framePaths.length);
    let audioFilter = null;
    if (hasAudio) {
      // aloop: loop the audio track enough times to cover the video,
      // then atrim to exact duration, then volume normalisation
      audioFilter =
        `[${framePaths.length}:a]` +
        `aloop=loop=-1:size=2e+09,` +
        `atrim=duration=${totalDuration},` +
        `volume=0.35` +
        `[aout]`;
    }

    // Combine video and audio filters
    const allFilters = audioFilter
      ? `${filterStr};${audioFilter}`
      : filterStr;

    cmd.complexFilter(allFilters);

    // ── Map outputs ──────────────────────────────────────────
    cmd.outputOptions(['-map', finalLabel]);
    if (hasAudio) {
      cmd.outputOptions(['-map', '[aout]']);
    }

    // ── Codec settings ───────────────────────────────────────
    cmd.videoCodec('libx264')
       .outputOptions([
         '-pix_fmt yuv420p',     // maximum browser compatibility
         '-crf 23',              // quality level (0–51; lower = better)
         '-preset fast',
         `-r ${FPS}`,
         `-s 1080x1920`,
         '-movflags +faststart', // moov atom first for web streaming
       ]);

    if (hasAudio) {
      cmd.audioCodec('aac').audioBitrate('128k');
    } else {
      cmd.outputOptions(['-an']); // no audio track
    }

    cmd.output(outputPath);

    cmd
      .on('start',    (cli) => console.log('[ffmpeg] start:', cli.slice(0, 120) + '…'))
      .on('progress', (p)   => {
        const pct = p.percent != null ? `${Math.round(p.percent)}%` : p.timemark;
        process.stdout.write(`\r[ffmpeg] ${pct}   `);
      })
      .on('end', () => {
        process.stdout.write('\n');
        // Verify the output file was actually written and is non-empty
        try {
          const stat = fs.statSync(outputPath);
          if (stat.size === 0) {
            return reject(new Error('FFmpeg finished but output file is empty.'));
          }
          console.log(`[ffmpeg] done → ${outputPath} (${(stat.size / 1024).toFixed(0)} KB)`);
          resolve();
        } catch {
          reject(new Error(`FFmpeg finished but output file not found: ${outputPath}`));
        }
      })
      .on('error', (err, stdout, stderr) => {
        process.stdout.write('\n');
        console.error('[ffmpeg] error:', err.message);
        if (stderr) console.error('[ffmpeg] stderr:', stderr.slice(-800));
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .run();
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Build an FFmpeg filter_complex string that crossfades n frames.
 *
 * For n=1 just copies the single input.
 * For n≥2 chains (n-1) xfade operations with 0.5 s overlap.
 *
 * Offsets are calculated so each xfade starts exactly at the point
 * where the previous scene has been showing for (SECONDS_PER_SCENE - FADE_DURATION).
 */
function buildXfadeFilter(n) {
  if (n === 1) {
    return { filterStr: '[0:v]copy[vout]', finalLabel: '[vout]' };
  }

  const parts   = [];
  let prevLabel = '[0:v]';

  for (let i = 1; i < n; i++) {
    const offset   = i * SECONDS_PER_SCENE - i * FADE_DURATION;
    const outLabel = i === n - 1 ? '[vout]' : `[v${i}]`;
    parts.push(
      `${prevLabel}[${i}:v]xfade=transition=fade:duration=${FADE_DURATION}:offset=${offset.toFixed(3)}${outLabel}`
    );
    prevLabel = outLabel;
  }

  return { filterStr: parts.join(';'), finalLabel: '[vout]' };
}

/**
 * Total video duration in seconds after xfade overlaps are applied.
 * n scenes × 4 s − (n-1) × 0.5 s overlap
 */
export function computeTotalDuration(n) {
  return n * SECONDS_PER_SCENE - Math.max(0, n - 1) * FADE_DURATION;
}
