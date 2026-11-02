# Sample Images

Six synthetic property images (1080×1920 JPEG) generated programmatically
by `backend/scripts/create-sample-images.js`.

## Files

| # | File | Subject |
|---|---|---|
| 1 | `01-exterior.jpg` | Exterior view |
| 2 | `02-living-room.jpg` | Living room |
| 3 | `03-kitchen.jpg` | Modern kitchen |
| 4 | `04-bedroom.jpg` | Master bedroom |
| 5 | `05-balcony.jpg` | Balcony view |
| 6 | `06-parking.jpg` | Covered parking |

## Provenance

These images are self-created gradient/colour-plate images generated with
Sharp — no external images, no licensing concerns, no attribution required.

## Regenerating

```powershell
node backend/scripts/create-sample-images.js
```

## Requirements for custom images

- Format: JPEG, PNG, or WebP
- Any resolution (images are resized to 1080×1920 during processing)
- Max size per file: 10 MB
- 4–8 images required
