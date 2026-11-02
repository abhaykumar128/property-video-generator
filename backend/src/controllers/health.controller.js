/**
 * health.controller.js
 * GET /api/health
 *
 * Returns application status.
 * SECURITY: must not expose API keys, filesystem paths, or env variable values.
 */

export function getHealth(_req, res) {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    services: {
      gemini:     process.env.GEMINI_API_KEY ? 'configured' : 'not configured (required for AI video generation)',
      ffmpeg:     'bundled via ffmpeg-static',
      videoModel: process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-1.1-flash',
    },
  });
}
