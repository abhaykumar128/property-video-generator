/**
 * test-api-key.js
 * Verify the GEMINI_API_KEY and explore available models + interactions API.
 */

import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

console.log('========================================');
console.log(' Gemini API Key Verification');
console.log('========================================\n');

if (!apiKey) {
  console.error('[FAIL] GEMINI_API_KEY is not set');
  process.exit(1);
}

console.log('Key prefix: ' + apiKey.slice(0, 10) + '...');
console.log('Key length: ' + apiKey.length + ' chars\n');

// -- Test 1: List available models via REST --
console.log('Test 1: List available models via REST API...');
try {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
  const body = await res.json();
  if (!res.ok) {
    console.log('  [FAIL] HTTP ' + res.status + ': ' + JSON.stringify(body.error?.message || body).slice(0, 300));
  } else {
    const models = body.models || [];
    console.log('  [OK] Found ' + models.length + ' models:');
    for (const m of models.slice(0, 20)) {
      console.log('    - ' + m.name + ' (' + (m.supportedGenerationMethods || []).join(', ') + ')');
    }
    if (models.length > 20) console.log('    ... and ' + (models.length - 20) + ' more');
  }
} catch (err) {
  console.log('  [FAIL] ' + String(err.message || err).slice(0, 200));
}

// -- Test 2: Try interactions API via REST --
console.log('\nTest 2: Try interactions API via REST (gemini-omni-1.1-flash)...');
try {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'gemini-omni-1.1-flash',
      input: 'A simple 2-second test: a white coffee cup on a wooden table, no movement.',
      response_format: { type: 'video', aspect_ratio: '9:16' },
    }),
  });

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (res.ok) {
    console.log('  [OK] HTTP ' + res.status);
    console.log('  Response keys: ' + (body ? Object.keys(body).join(', ') : 'none'));
    if (body?.id) console.log('  Interaction ID: ' + body.id);
    if (body?.status) console.log('  Status: ' + body.status);
    if (body?.steps) {
      for (const step of body.steps) {
        console.log('  Step type: ' + step.type);
        if (step.content) {
          for (const c of step.content) {
            if (c.type === 'video') {
              if (c.data) console.log('  Video data: ' + c.data.length + ' chars (base64)');
              if (c.uri)  console.log('  Video URI: ' + String(c.uri).slice(0, 80));
            }
          }
        }
      }
    }
  } else {
    console.log('  [FAIL] HTTP ' + res.status);
    console.log('  Response: ' + String(text).slice(0, 500));
  }
} catch (err) {
  console.log('  [FAIL] ' + String(err.message || err).slice(0, 200));
}

// -- Test 3: Try text generation with a different model name --
console.log('\nTest 3: Try text generation with gemini-2.0-flash...');
try {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say "hello" in one word.' }] }],
    }),
  });
  const body = await res.json();
  if (res.ok) {
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('  [OK] Response: "' + (text || '(empty)') + '"');
  } else {
    console.log('  [FAIL] HTTP ' + res.status + ': ' + String(body.error?.message || '').slice(0, 200));
  }
} catch (err) {
  console.log('  [FAIL] ' + String(err.message || err).slice(0, 200));
}

console.log('\n========================================');
console.log(' Verification complete');
console.log('========================================');
