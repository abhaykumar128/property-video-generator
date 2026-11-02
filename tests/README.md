# Tests

## Running the backend tests

```bash
# From the project root
cd backend && npm install
cd ..
node --test tests/backend.test.js
```

Uses the Node.js built-in test runner (`node:test`) introduced in v18.
No extra test framework required.

## What is tested

| Test | Type | File |
|---|---|---|
| `GET /api/health` → 200 | Integration | backend.test.js |
| Submit with no images → 422 | Integration | backend.test.js |
| Submit with invalid JSON → 400 | Integration | backend.test.js |
| Submit with missing fields → 422 | Integration | backend.test.js |
| Generate with unknown jobId → 404 | Integration | backend.test.js |
| Generate with missing jobId → 400 | Integration | backend.test.js |
| Status with unknown jobId → 404 | Integration | backend.test.js |
| `buildTemplateScript` scene count | Unit | backend.test.js |
| `buildTemplateScript` uses highlights | Unit | backend.test.js |
| `propertySchema` rejects bedrooms > 20 | Unit | backend.test.js |
| `propertySchema` accepts valid input | Unit | backend.test.js |

## What is NOT tested here (manual verification recommended)

- Actual FFmpeg video rendering (requires FFmpeg installed + real images)
- Gemini API script generation (requires a valid API key)
- Frontend UI flows (recommend Playwright or Cypress for E2E)

## Adding frontend tests

Install Vitest and React Testing Library, then add `*.test.jsx` files
alongside components. Example setup:

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `frontend/package.json` scripts:
```json
"test": "vitest --run"
```
