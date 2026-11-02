# Approach, Key Decisions & Limitations

## Architecture Overview

The application uses Google Gemini Omni Flash for real AI video generation.
Uploaded property images are sent as references to the Gemini Interactions API,
which generates photorealistic, cinematic video footage. FFmpeg then overlays
accurate property text captions on the AI-generated video.

```
Browser (React SPA)
  → Step 1: Property form
  → Step 2: Image upload (drag-drop, 4–8 images)
  → Step 3: Script generation  → POST /api/scripts/generate
  → Step 4: AI video generation → POST /api/videos/generate (submit)
     Backend AI pipeline:
       1. Build internal creative prompt (promptBuilder.service.js)
       2. Call Gemini Omni Flash (image-to-video with reference images)
       3. Extend video via multi-turn interactions (target 20–30s)
       4. Overlay accurate captions using Sharp PNGs + FFmpeg
       5. Verify output (file exists, non-empty, H.264)
     Client polls GET /api/videos/jobs/:id for progress
  → Step 5: Preview + download → GET /api/videos/:id/stream
                               → GET /api/videos/:id/download
```

## Pipeline

```
1. Prompt builder           →  internal creative direction from property data + images
2. Gemini Omni Flash API     →  photorealistic AI video footage (8s initial, extended to ~24s)
3. Video extension           →  multi-turn continuation via previous_interaction_id
4. Caption overlay (Sharp)  →  transparent PNG overlays with property text
5. FFmpeg post-processing    →  overlay PNGs on AI video at timed intervals, scale to 1080×1920
6. Verification              →  file exists + non-empty + H.264 codec check
```

## Key Decisions

### Template fallback for script generation

The Gemini prompt explicitly prohibits inventing amenities. A deterministic
template engine provides identical output shape when Gemini is unavailable.
This means the application works fully in offline or no-API-key environments
(important for assignment review).

### FFmpeg bundled via ffmpeg-static

Using `ffmpeg-static` eliminates the system FFmpeg requirement — the binary
is downloaded during `npm install`. No manual installation needed on any
platform.

### Asynchronous job processing with polling

Video rendering blocks for 20–40 seconds. The controller fires the pipeline
as a background Promise, returns 202 immediately, and the client polls every
3 seconds. This keeps the API responsive.

### UUID job IDs and safe filenames

All uploaded files are stored with UUID-based names (Multer config). The
output MP4 is `<jobId>.mp4`. User-supplied filenames are never used in
filesystem paths, eliminating path traversal risk.

### 9:16 vertical format (1080×1920)

Property promotional videos are increasingly consumed on mobile and shared
on Instagram Reels and WhatsApp Stories. 9:16 is the natural format.

### SVG text overlays via Sharp

Sharp's `composite()` method accepts SVG buffers directly. This avoids a
font installation requirement — librsvg (embedded in Sharp) renders generic
`font-family="sans-serif"` with the best available system font. Text is
XML-escaped before insertion to prevent SVG injection.

### In-memory job store

For assignment scope, a `Map<string, job>` in the Node process is sufficient.
It avoids a database dependency while keeping the architecture simple and
transparent. Jobs are lost on restart.

## Libraries & External Services

| Name | Version | Purpose |
|---|---|---|
| @google/genai | ^2.32.0 | Gemini Omni Flash video generation (Interactions API) |
| @google/generative-ai | ^0.21.0 | Gemini text script generation |
| Express | ^5.0.1 | HTTP server |
| Multer | ^1.4.5-lts.1 | Multipart upload |
| Zod | ^3.23.8 | Validation |
| Sharp | ^0.33.4 | Caption overlay PNG generation |
| fluent-ffmpeg | ^2.1.3 | FFmpeg wrapper for caption overlay |
| ffmpeg-static | ^5.3.0 | Bundled FFmpeg binary |
| React | ^18.3.1 | Frontend |
| Vite | ^5.4.2 | Build tool |

## Limitations

| Limitation | Detail |
|---|---|
| Requires GEMINI_API_KEY | AI video generation requires a valid Gemini API key |
| AI generation latency | 1–3 minutes per video (API call + polling + extension) |
| In-memory jobs | Lost on restart — no database |
| AI may alter details | Generative model may not perfectly preserve all reference image details |
| Single process | No worker queue — one AI job at a time |
| No cleanup cron | Uploads and outputs accumulate on disk |
| Gemini free tier | Rate limits and quotas may restrict generations |
| No auth | Open API — demo only |
| Vertical only | No landscape (16:9) format option |
