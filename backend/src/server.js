/**
 * server.js
 * Entry point — loads env vars then starts Express.
 */

import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[server] Backend running at http://localhost:${PORT}`);
  console.log(`[server] Gemini:  ${process.env.GEMINI_API_KEY ? '✓ configured' : '✗ not set (required for AI video generation)'}`);
  console.log(`[server] Video model: ${process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-1.1-flash'}`);
  console.log(`[server] FFmpeg:   bundled via ffmpeg-static`);
});
