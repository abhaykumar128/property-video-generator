# API Reference

Base URL: `http://localhost:4000`

All endpoints return JSON. Error responses follow `{ "error": "message" }`.

---

## GET /api/health

Liveness check. Never exposes secrets, paths, or environment values.

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

---

## POST /api/scripts/generate

Generate a promotional script from property details (no images required).

**Request** — `application/json`:

| Field | Type | Required | Description |
|---|---|---|---|
| `propertyName` | string (2–120) | yes | Property listing name |
| `location` | string (2–200) | yes | Property location |
| `price` | string (1–60) | yes | Asking price |
| `propertyType` | string (2–80) | yes | Type of property |
| `features` | string[] (1–12) | yes | Key features |
| `description` | string (≤1000) | no | Property description |
| `contactText` | string (≤200) | no | Contact / enquiry text |
| `agentName` | string (≤100) | no | Agent name |
| `agentPhone` | string (≤30) | no | Agent phone |
| `agentEmail` | email string | no | Agent email |
| `imageCount` | number | no | Override scene count (default: features.length + 2) |

**Response 200:**
```json
{
  "success": true,
  "script": {
    "openingTitle": "Sunrise Residency — 2-BHK Apartment in Mohali, Punjab",
    "voiceOver": "Presenting Sunrise Residency, a 2-BHK Apartment…",
    "scenes": [
      { "sceneIndex": 0, "caption": "Sunrise Residency · Mohali, Punjab", "type": "opening" },
      { "sceneIndex": 1, "caption": "Two spacious bedrooms", "type": "feature" },
      { "sceneIndex": 2, "caption": "Private balcony with city view", "type": "feature" },
      { "sceneIndex": 3, "caption": "Covered parking included", "type": "feature" },
      { "sceneIndex": 4, "caption": "Modern modular kitchen", "type": "feature" },
      { "sceneIndex": 5, "caption": "Priced at ₹85 lakh", "type": "closing" }
    ],
    "callToAction": "Call Priya Sharma on +91 98765 43210 to schedule a visit.",
    "source": "template"
  }
}
```

**Error 422:**
```json
{
  "error": "Validation failed.",
  "issues": {
    "propertyName": ["Required"],
    "location": ["Required"]
  }
}
```

---

## POST /api/videos/generate

Submit property details and images. Starts async video generation and returns a job ID.

**Request** — `multipart/form-data`:

| Field | Type | Required | Description |
|---|---|---|---|
| `data` | string (JSON) | yes | JSON string of the property object (same schema as scripts/generate) |
| `images` | file[] | yes | 4–8 images (JPEG / PNG / WebP, max 10 MB each) |
| `audio` | file | no | Optional audio track (MP3 / WAV / AAC, max 20 MB) |

**Response 202:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Video generation started. Poll GET /api/videos/jobs/:jobId for updates."
}
```

**Error responses:**

| Status | Cause |
|---|---|
| 400 | `data` field is missing or not valid JSON |
| 413 | Image exceeds `MAX_FILE_SIZE_MB` |
| 422 | Validation failed (property fields or image count < 4) |
| 400 | Unsupported file type or unexpected field name |

---

## GET /api/videos/jobs/:jobId

Poll job status. Returns current status, progress message, and script (once generated).

**Response 200:**
```json
{
  "jobId": "550e8400-…",
  "status": "processing",
  "progress": "Images ready. Rendering video…",
  "script": { "openingTitle": "…", "scenes": […], "callToAction": "…", "source": "template" }
}
```

**Status values:**

| Value | Meaning |
|---|---|
| `queued` | Job created, not yet started |
| `processing` | Script generation, frame building, or FFmpeg rendering |
| `completed` | MP4 is ready at `videoUrl` |
| `failed` | Pipeline failed — see `error` field |

**Completed response:**
```json
{
  "jobId": "550e8400-…",
  "status": "completed",
  "progress": "Video ready (591 KB).",
  "videoUrl": "/outputs/550e8400-….mp4"
}
```

**Failed response:**
```json
{
  "jobId": "550e8400-…",
  "status": "failed",
  "progress": "Video generation failed.",
  "error": "FFmpeg failed: …"
}
```

**Error 404** — unknown job ID:
```json
{ "error": "No job found with id \"00000000-…\"." }
```

---

## GET /api/videos/:jobId/stream

Stream the completed MP4 with HTTP range-request support for browser `<video>` playback.

**Headers:**
```
Range: bytes=0-1023
```

**Response 206** (partial content):
```
Content-Type: video/mp4
Content-Range: bytes 0-1023/591000
Accept-Ranges: bytes
Content-Length: 1024
```

**Response 200** (full content — no Range header):
```
Content-Type: video/mp4
Content-Length: 591000
```

**Error responses:**

| Status | Cause |
|---|---|
| 404 | Unknown job ID |
| 409 | Job is not completed yet |

---

## GET /api/videos/:jobId/download

Download the completed MP4 as an attachment with a safe filename.

**Response 200:**
```
Content-Type: video/mp4
Content-Disposition: attachment; filename="property-video-550e8400-….mp4"
```

**Error responses:**

| Status | Cause |
|---|---|
| 404 | Unknown job ID |
| 409 | Job is not completed yet |

---

## GET /outputs/:filename

Direct static file serve for generated MP4s. Used for debugging.
Filename is `<jobId>.mp4` (UUID — safe, no user input).
