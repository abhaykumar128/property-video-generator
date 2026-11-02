# PropertyStudio AI — AI Property Video Generator

Turn real estate property photos into ready-to-share promotional MP4 videos. Enter property details, upload 4–8 images, generate an AI-written script, and the application uses Google Gemini Omni AI to generate professional, photorealistic video footage with accurate property captions.

---

## 1. Project Objective

Build a working web application that takes real estate property details and property images and automatically produces a professional promotional MP4 video with text overlays and transitions.

The application lets users:
1. Enter property information.
2. Upload and preview property images.
3. Generate a promotional script and captions.
4. Create a video automatically from the images and captions.
5. Preview the generated video.
6. Download the final MP4.

---

## 2. Real Estate Business Problem

Real estate agents spend significant time creating promotional videos for property listings. This typically requires video editing skills, expensive software, and manual effort to combine photos, add captions, and produce a shareable format.

PropertyStudio AI automates this process: an agent enters property details and uploads photos, and the application generates a polished 20–40 second vertical video (1080×1920) suitable for mobile platforms and social media — all in seconds.

---

## 3. Main Features

- **5-step wizard UI** — property details → image upload → script review → video generation → preview/download
- **AI video generation** — Google Gemini Omni Flash generates photorealistic, cinematic video footage from uploaded property images
- **AI script generation** — Google Gemini writes promotional captions from property facts (template fallback if no API key)
- **Editable captions** — review and edit AI-generated scene captions before video generation
- **Drag-and-drop image upload** — 4–8 images with thumbnail previews and reordering
- **Accurate text overlays** — FFmpeg overlays property captions with professional typography on AI-generated footage
- **Vertical 9:16 format** — optimised for mobile / reels / stories (1080×1920)
- **Sample data loader** — one-click fill with synthetic property details
- **Async job processing** — non-blocking video generation with live status polling
- **Streaming + download** — preview in-browser with range-request support, download with correct content type

---

## 4. Technology Stack and Architecture

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, JavaScript ES modules, plain CSS |
| Backend | Node.js 22, Express 5, JavaScript ES modules |
| Validation | Zod |
| File upload | Multer |
| AI script | Google Gemini API (`@google/generative-ai` SDK) — template fallback if no key |
| AI video | Google Gemini Omni Flash (`@google/genai` SDK, `gemini-omni-1.1-flash` model) |
| Image processing | Sharp (resize, SVG text overlay PNGs for captions) |
| Video post-processing | FFmpeg via `fluent-ffmpeg` + `ffmpeg-static` (caption overlay, scaling, encoding) |

### Architecture

```
Browser (React)
  → Step 1: Property form (user enters details)
  → Step 2: Image upload (4–8 photos, drag-and-drop reorder)
  → Step 3: Script generation → POST /api/scripts/generate (Gemini or template)
  → Step 4: AI video generation → POST /api/videos/generate
     Backend pipeline:
       1. Build internal creative prompt from property data + images
       2. Call Gemini Omni Flash (image-to-video with reference images)
       3. Extend video via multi-turn interactions (target 20–30s)
       4. Overlay accurate captions using Sharp PNGs + FFmpeg
       5. Verify output (file exists, non-empty, H.264)
     Client polls GET /api/videos/jobs/:jobId for progress
  → Step 5: Preview + download → GET /api/videos/:jobId/stream + /download
```
                                →  File serve (stream/download)
```

The backend pipeline runs asynchronously — the frontend submits a job, then polls for status until the MP4 is ready.

---

## 5. Project Directory Structure

```
property-video-generator/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── scripts/
│   │   ├── create-sample-images.js    # Generate synthetic sample JPEGs
│   │   └── generate-sample.js         # Generate sample MP4 from sample data
│   ├── src/
│   │   ├── app.js                      # Express app configuration
│   │   ├── server.js                   # Entry point
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   ├── scripts.routes.js
│   │   │   └── videos.routes.js
│   │   ├── controllers/
│   │   │   ├── health.controller.js
│   │   │   ├── scripts.controller.js
│   │   │   └── videos.controller.js
│   │   ├── services/
│   │   │   ├── gemini.service.js        # Gemini text script generation + fallback
│   │   │   ├── template.service.js     # Deterministic template script
│   │   │   ├── promptBuilder.service.js # Internal AI video prompt builder
│   │   │   ├── geminiVideo.service.js  # Gemini Omni AI video generation + extension
│   │   │   ├── job.service.js          # In-memory job store
│   │   │   └── video.service.js        # AI video pipeline orchestrator
│   │   ├── middleware/
│   │   │   ├── upload.js               # Multer config (images + audio)
│   │   │   ├── errorHandler.js
│   │   │   └── requestLogger.js
│   │   └── utils/
│   │       ├── validation.js           # Zod schemas
│   │       ├── frameRenderer.js        # Sharp frame builder (used by FFmpeg smoke test)
│   │       ├── ffmpegRenderer.js       # FFmpeg MP4 renderer (used by smoke test)
│   │       └── videoCaptioner.js       # FFmpeg caption overlay on AI video
│   ├── uploads/                        # Runtime (gitignored)
│   └── outputs/                        # Runtime (gitignored)
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                     # 5-step wizard orchestrator
│       ├── api/
│       │   ├── client.js               # Fetch wrapper + error handling
│       │   ├── propertyApi.js          # Submit property + images
│       │   └── videoApi.js             # Script generation + job polling
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── StepIndicator.jsx
│       │   ├── StatusMessage.jsx
│       │   └── FormField.jsx
│       ├── pages/
│       │   ├── PropertyForm.jsx         # Step 1
│       │   ├── ImageUpload.jsx          # Step 2
│       │   ├── ScriptPreview.jsx       # Step 3
│       │   ├── VideoGenerationPanel.jsx # Step 4
│       │   └── VideoPreview.jsx          # Step 5
│       └── styles/
│           ├── global.css               # Design tokens + resets
│           └── app.css                  # Layout + header + stepper
├── samples/
│   ├── sample-property.json            # Synthetic property data
│   ├── sample-images/                  # 6 synthetic JPEG images
│   │   ├── 01-exterior.jpg
│   │   ├── 02-living-room.jpg
│   │   ├── 03-kitchen.jpg
│   │   ├── 04-bedroom.jpg
│   │   ├── 05-balcony.jpg
│   │   └── 06-parking.jpg
│   └── output/
│       └── sample-property-video.mp4    # Real generated sample MP4
├── tests/
│   └── backend.test.js                 # 53 automated tests
├── docs/
│   ├── approach.md
│   ├── api.md
│   └── DEMO_GUIDE.md
├── .gitignore
└── README.md
```

---

## 6. Prerequisites

### Node.js (required)

Download from <https://nodejs.org/> — version 18 or later required.

Verify:
```powershell
node --version   # Should print v18.x.x or higher
```

### FFmpeg (bundled — no manual install needed)

FFmpeg is bundled via the `ffmpeg-static` npm package. The binary is downloaded automatically when you run `npm install` in the backend directory. No system-level FFmpeg installation is required.

If you prefer to use a system FFmpeg, set `FFMPEG_PATH` in `backend/.env` to the full path of your `ffmpeg.exe`.

### Windows-specific notes

- All commands in this README use PowerShell syntax
- Use `Copy-Item` instead of `cp` for file copies
- Path separators are backslashes (`\`)

---

## 7. Installation Instructions

### Backend

```powershell
cd "property-video-generator\backend"
npm install
```

### Frontend

```powershell
cd "property-video-generator\frontend"
npm install
```

If prompted to approve install scripts (for `sharp` or `ffmpeg-static`), run:
```powershell
npm approve-scripts sharp
npm approve-scripts ffmpeg-static
npm install
```

---

## 8. Environment Variable Configuration

### Backend (`backend/.env`)

Copy the example file and fill in values:

```powershell
cd backend
Copy-Item .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `4000` | HTTP port |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Allowed frontend origin |
| `GEMINI_API_KEY` | **yes** | (empty) | Google Gemini API key — required for AI video generation and AI script generation |
| `GEMINI_MODEL` | no | `gemini-1.5-flash` | Gemini model for script generation |
| `GEMINI_VIDEO_MODEL` | no | `gemini-omni-1.1-flash` | Gemini Omni model for AI video generation |
| `FFMPEG_PATH` | no | (bundled) | Override FFmpeg binary path |
| `UPLOAD_DIR` | no | `./uploads` | Uploaded image storage |
| `OUTPUT_DIR` | no | `./outputs` | Generated MP4 storage |
| `MAX_FILE_SIZE_MB` | no | `10` | Max image size per upload |
| `MAX_AUDIO_SIZE_MB` | no | `20` | Max audio file size |

### Frontend (`frontend/.env`)

```powershell
cd frontend
Copy-Item .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | no | (empty) | Backend base URL — empty in dev (uses Vite proxy) |

**Security note:** Never put `GEMINI_API_KEY` in frontend environment variables. The `VITE_` prefix exposes variables to the browser — only `VITE_API_URL` is safe.

---

## 9. Gemini API Setup

1. Go to <https://aistudio.google.com/app/apikey>
2. Create a new API key (free tier available)
3. Copy the key (it starts with `AIza…`)
4. Paste it into `backend/.env`:
   ```
   GEMINI_API_KEY=AIzaSyYourKeyHere
   ```
5. Optionally set the model:
   ```
   GEMINI_MODEL=gemini-1.5-flash
   ```

Restart the backend after changing `.env`.

---

## 10. How the Application Works Without a Gemini API Key

### Script generation (template fallback)

If `GEMINI_API_KEY` is not set (or the API call fails), the **script generation** step automatically falls back to a deterministic template-based generator (`template.service.js`).

The template generator:
- Uses the supplied property name, location, price, type, features, and contact text
- Creates an opening scene (property name + location)
- Creates one feature scene per image
- Creates a closing scene (price + contact)
- **Never invents facts** — no swimming pool, gym, school, or discount unless listed

The response includes a `source` field (`'gemini'` or `'template'`) so the frontend can display which engine produced the script.

### Video generation (requires API key)

**AI video generation requires a valid `GEMINI_API_KEY`.** The application does NOT silently fall back to a static slideshow when the key is missing — it fails with a clear error message explaining that the key is required.

To enable AI video generation:
1. Set `GEMINI_API_KEY` in `backend/.env`
2. Ensure your API key has access to the `gemini-omni-1.1-flash` model
3. Restart the backend

---

## 11. Commands to Start the Application

Open two terminal windows:

**Terminal 1 — Backend:**
```powershell
cd "property-video-generator\backend"
npm run dev
```
Server starts on `http://localhost:4000`.

**Terminal 2 — Frontend:**
```powershell
cd "property-video-generator\frontend"
npm run dev
```
UI opens at `http://localhost:5173`.

The Vite dev server proxies `/api` and `/outputs` requests to the backend automatically — no CORS configuration needed in development.

---

## 12. How to Use the Website (End-to-End)

1. **Open** `http://localhost:5173` in your browser
2. **Step 1 — Property Details:** Fill in the property form (or click "Load Sample Data" to auto-fill with synthetic data). Click "Next: Upload Images"
3. **Step 2 — Upload Images:** Drag and drop 4–8 JPEG/PNG/WebP images. Drag thumbnails to reorder scenes. Click "Next: Generate Script"
4. **Step 3 — Review Script:** The application generates a promotional script (AI or template). Review the opening title, scene captions, and call to action. Edit any caption by clicking on it. Click "Next: Generate Video"
5. **Step 4 — Generate Video:** Click "Generate Video". The backend processes the job asynchronously — watch the progress messages. This takes 20–40 seconds
6. **Step 5 — Preview & Download:** The video player loads automatically. Use the controls to preview. Click "Download MP4" to save the file. Click "Create Another Video" to start over

---

## 13. API Endpoint Documentation

Base URL: `http://localhost:4000`

### GET /api/health

Health check — no secrets exposed.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-29T10:00:00.000Z",
  "services": {
    "gemini": "not configured (template fallback active)",
    "json2video": "not configured"
  }
}
```

### POST /api/scripts/generate

Generate a promotional script from property details.

**Request** (`application/json`):
```json
{
  "propertyName": "Sunrise Residency",
  "location": "Mohali, Punjab",
  "price": "₹85 lakh",
  "propertyType": "2-BHK Apartment",
  "features": ["Two bedrooms", "Balcony", "Covered parking"],
  "contactText": "Contact us to schedule a visit"
}
```

**Response 200:**
```json
{
  "success": true,
  "script": {
    "openingTitle": "Sunrise Residency — 2-BHK Apartment in Mohali, Punjab",
    "voiceOver": "Presenting Sunrise Residency…",
    "scenes": [
      { "sceneIndex": 0, "caption": "Sunrise Residency · Mohali, Punjab", "type": "opening" },
      { "sceneIndex": 1, "caption": "Two bedrooms", "type": "feature" },
      ...
    ],
    "callToAction": "Call Priya Sharma on +91 98765 43210 to schedule a visit.",
    "source": "template"
  }
}
```

**Error 422** — missing required field:
```json
{ "error": "Validation failed.", "issues": { "propertyName": ["Required"] } }
```

### POST /api/videos/generate

Submit property + images and start async video generation.

**Request** (`multipart/form-data`):
- `data` — JSON string of the property object
- `images` — 4–8 image files (JPEG/PNG/WebP)

**Response 202:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Video generation started. Poll GET /api/videos/jobs/:jobId for updates."
}
```

**Error 422** — fewer than 4 images:
```json
{ "error": "At least 4 images are required. Received 2." }
```

### GET /api/videos/jobs/:jobId

Poll job status.

**Response 200:**
```json
{
  "jobId": "550e8400-…",
  "status": "processing",
  "progress": "Images ready. Rendering video…",
  "script": { ... }
}
```

Status values: `queued` → `processing` → `completed` (or `failed`)

**Completed:**
```json
{
  "jobId": "550e8400-…",
  "status": "completed",
  "progress": "Video ready (591 KB).",
  "videoUrl": "/outputs/550e8400-….mp4"
}
```

**Failed:**
```json
{
  "jobId": "550e8400-…",
  "status": "failed",
  "progress": "Video generation failed.",
  "error": "FFmpeg failed: …"
}
```

### GET /api/videos/:jobId/stream

Stream the completed MP4 with HTTP range support for browser playback.

Returns `404` for unknown jobs, `409` if job is not completed.

### GET /api/videos/:jobId/download

Download the completed MP4 with `Content-Disposition: attachment`.

Returns `404` for unknown jobs, `409` if job is not completed.

---

## 14. Supported Image and Audio Formats

### Images (required — 4 to 8)

| Format | MIME type | Extension |
|---|---|---|
| JPEG | `image/jpeg` | `.jpg`, `.jpeg` |
| PNG | `image/png` | `.png` |
| WebP | `image/webp` | `.webp` |

Max file size: 10 MB per image (configurable via `MAX_FILE_SIZE_MB`).

### Audio (optional)

| Format | MIME type |
|---|---|
| MP3 | `audio/mpeg` |
| WAV | `audio/wav` |
| AAC | `audio/aac` |

Max file size: 20 MB (configurable via `MAX_AUDIO_SIZE_MB`).

**Legal note:** Users must hold the necessary rights to any uploaded audio. Do not upload copyrighted music.

---

## 15. Where Generated Videos Are Stored

Generated MP4 files are saved to `backend/outputs/<jobId>.mp4` (or the path specified by `OUTPUT_DIR`).

They are served:
- **Stream:** `GET /api/videos/:jobId/stream` (range-request aware for browser `<video>`)
- **Download:** `GET /api/videos/:jobId/download` (attachment with safe filename)
- **Direct:** `GET /outputs/<jobId>.mp4` (static file serve for debugging)

The sample MP4 is saved at `samples/output/sample-property-video.mp4`.

Uploads (original images) are stored in `backend/uploads/` and are gitignored.

---

## 16. How to Run Tests

```powershell
# From the project root
node --test tests/backend.test.js
```

Or from the backend directory:
```powershell
cd backend
npm test
```

Tests use the Node.js built-in test runner (`node:test`) — no extra framework required.

### Test results (last run)

| Group | Tests | Result |
|---|---|---|
| Health endpoint | 3 | ✅ pass |
| Script generation — valid | 3 | ✅ pass |
| Script generation — negative | 7 | ✅ pass |
| Template service — unit | 7 | ✅ pass |
| Gemini fallback (no key) | 1 | ✅ pass |
| Gemini fallback (invalid key) | 1 | ✅ pass |
| Video — image count validation | 6 | ✅ pass |
| Video — field validation | 5 | ✅ pass |
| Job status polling | 3 | ✅ pass |
| Stream/download before completion | 4 | ✅ pass |
| Unknown routes | 2 | ✅ pass |
| Schema edge cases | 7 | ✅ pass |
| Error responses — no secrets | 3 | ✅ pass |
| FFmpeg smoke test (real MP4) | 1 | ✅ pass |
| Prompt builder — unit | 6 | ✅ pass |
| AI pipeline — missing API key | 1 | ✅ pass |
| Manual (documented, skipped) | 10 | ⏭ skip |
| **Total** | **70** | **60 pass, 10 skip, 0 fail** |

---

## 17. How to Generate the Sample MP4

### Step 1: Create sample images (already included)

```powershell
node backend/scripts/create-sample-images.js
```

This generates 6 synthetic JPEG images (1080×1920) in `samples/sample-images/`. These are self-created gradient images — no licensing concerns.

### Step 2: Generate the sample MP4

```powershell
node backend/scripts/generate-sample.js
```

This reads `samples/sample-property.json` + `samples/sample-images/*.jpg`, runs the full AI pipeline (prompt building → Gemini Omni video generation → extension → caption overlay), and saves the result to `samples/output/sample-property-video.mp4`.

**Note:** Generating the sample MP4 requires a valid `GEMINI_API_KEY` in `backend/.env` with access to the `gemini-omni-1.1-flash` model. Without it, the generation will fail with a clear error message.

The existing sample MP4 at `samples/output/sample-property-video.mp4` was generated using the previous FFmpeg-based pipeline and is included as a reference. To regenerate with AI video, configure the API key and run the script.

### Verify the sample MP4

```powershell
# Check it exists and is non-empty
Get-Item samples\output\sample-property-video.mp4 | Select Name, Length

# Probe format with FFmpeg
node -e "const p=require('ffmpeg-static');const {execSync}=require('child_process');console.log(execSync(p+' -i samples/output/sample-property-video.mp4 2>&1').toString().split('\n').filter(l=>l.includes('Duration')||l.includes('Video')).join('\n'))"
```

Expected output:
```
Duration: 00:00:21.50, start: 0.000000, bitrate: N/A
Stream #0:0…: Video: h264 …, yuv420p, 1080x1920 [SAR 1:1 DAR 9:16], 30 fps
```

---

## 18. Error Handling and Security Measures

### Error handling

| Scenario | Behaviour |
|---|---|
| Missing required property field | 422 with field-specific error message |
| Fewer than 4 images | 422 with count shown |
| More than 8 images | Multer rejects with 400 |
| Unsupported file type | 400 with accepted formats listed |
| Invalid JSON in request | 400 with clear message |
| Oversized file | 413 with size limit shown |
| Missing Gemini key (script) | Template fallback activates automatically |
| Missing Gemini key (video) | Job fails with clear error — "GEMINI_API_KEY is not configured" |
| Gemini API failure (script) | Sanitized error logged server-side, template fallback used |
| Gemini API failure (video) | Job marked `failed` with sanitized error message |
| Gemini returns malformed JSON | Caught and validated, fallback used |
| Gemini Omni timeout | 3-minute timeout per API call, job marked `failed` |
| Gemini Omni quota exceeded | Error caught, job marked `failed` with message |
| Missing FFmpeg binary | Clear error message with setup instructions |
| FFmpeg process failure | Job marked `failed` with error message |
| Unknown job ID | 404 |
| Download before completion | 409 with current status |
| Unknown API route | 404 |
| Backend unreachable (frontend) | "Cannot reach the backend server" message |

### Security measures

- **API keys** stored in `backend/.env` only — never in frontend code, never in API responses, never logged
- **Filename sanitisation** — Multer generates UUID-based filenames, original names discarded
- **Path traversal protection** — video paths are constructed from UUIDs only, never from user input
- **Upload limits** — 10 MB per image, 20 MB per audio, 8 image max
- **MIME validation** — file content checked, not just extension
- **SVG injection prevention** — all text overlays are XML-escaped before compositing
- **No shell injection** — FFmpeg is invoked via `fluent-ffmpeg` (programmatic API), never via raw shell strings
- **No secrets in responses** — health endpoint shows only "configured"/"not configured", never actual values
- **CORS** restricted to configured origin
- **`.env` files gitignored** — never committed to version control

---

## 19. AI Models, APIs, Libraries, and External Services

| Name | Version | Purpose | Link |
|---|---|---|---|
| @google/genai | ^2.32.0 | Google Gen AI SDK for Gemini Omni video generation | <https://ai.google.dev/gemini-api/docs/omni> |
| @google/generative-ai | ^0.21.0 | Gemini API SDK for text script generation | <https://ai.google.dev> |
| Express | ^5.0.1 | HTTP server and routing | <https://expressjs.com> |
| Multer | ^1.4.5-lts.1 | Multipart file upload handling | <https://github.com/expressjs/multer> |
| Zod | ^3.23.8 | Runtime request validation | <https://zod.dev> |
| Sharp | ^0.33.4 | Image processing, SVG text overlay PNGs for captions | <https://sharp.pixelplumbing.com> |
| fluent-ffmpeg | ^2.1.3 | FFmpeg wrapper for caption overlay and video encoding | <https://github.com/fluent-ffmpeg/node-fluent-ffmpeg> |
| ffmpeg-static | ^5.3.0 | Bundled FFmpeg binary (no system install needed) | <https://github.com/eugeneware/ffmpeg-static> |
| React | ^18.3.1 | Frontend UI framework | <https://react.dev> |
| Vite | ^5.4.2 | Frontend build tool and dev server | <https://vitejs.dev> |
| dotenv | ^16.4.5 | Environment variable loading | <https://github.com/motdotla/dotenv> |
| cors | ^2.8.5 | Cross-origin resource sharing | <https://github.com/expressjs/cors> |

**Google Gemini Omni Flash** (`gemini-omni-1.1-flash`) generates photorealistic, cinematic AI video footage from the user's uploaded property images. The application builds an internal creative prompt automatically — the user never needs to write video prompts.

**Google Gemini** (text model, `gemini-1.5-flash`) generates promotional script text from property facts. A deterministic template fallback is used when the API key is missing or the call fails.

**FFmpeg** is used only for post-processing — overlaying accurate property text captions on the AI-generated footage, scaling, and encoding to H.264 MP4. It does not replace AI video generation.

---

## 20. Limitations and Possible Future Improvements

### Current limitations

| Limitation | Detail |
|---|---|
| Requires GEMINI_API_KEY | AI video generation requires a valid Gemini API key with access to gemini-omni-1.1-flash |
| AI generation latency | Video generation takes 1–3 minutes (API call + polling + extension) |
| In-memory job store | Jobs are lost on server restart — no database persistence |
| AI model output resolution | Default 720p from API; FFmpeg scales to 1080×1920 during caption overlay |
| AI model may alter details | Generative AI may not perfectly preserve all architectural details from reference images |
| Single server process | One AI generation job at a time per process |
| Gemini free tier limits | Rate limits and quotas may restrict the number of generations |
| No user authentication | Open API — suitable for demo, not production |
| Vertical only | Currently outputs 9:16 (1080×1920); no landscape option |
| Sample MP4 | The included sample was generated with the previous FFmpeg pipeline; AI regeneration requires an API key |

### Future improvements

- Add SQLite or Redis job persistence
- Add background music library with royalty-free tracks
- Add worker queue (BullMQ) for scalable rendering
- Add user authentication and per-user job history
- Add landscape (16:9) video format option
- Add text-to-speech voiceover integration
- Add Ken Burns zoom effect on images
- Add video watermark / branding overlay
- Add multiple video resolution options (720p, 1080p, 4K)
- Add frontend E2E tests with Playwright

---

## License

MIT — for assignment / demonstration purposes only.
All sample data is synthetic and anonymized. No real customer data is used.
