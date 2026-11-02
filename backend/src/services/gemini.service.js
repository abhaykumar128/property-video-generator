/**
 * gemini.service.js
 * Generates a promotional real estate script using the Google Gemini API.
 *
 * Falls back to template generation on any failure.
 *
 * SECURITY:
 *   - API key is read from env; never logged, never returned to clients.
 *   - Raw provider errors are sanitized before logging.
 *
 * OUTPUT SHAPE (same for both Gemini and template paths):
 * {
 *   openingTitle: string,
 *   voiceOver:    string,
 *   scenes: [
 *     { sceneIndex: number, caption: string, type: 'opening'|'feature'|'closing' }
 *   ],
 *   callToAction: string,
 *   source: 'gemini' | 'template'
 * }
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildTemplateScript } from './template.service.js';

/**
 * Generate a promotional script for the given property.
 *
 * @param {object} property   Validated property object
 * @param {number} imageCount Number of uploaded images
 * @returns {Promise<object>} Script object
 */
export async function generateScript(property, imageCount) {
  const apiKey   = process.env.GEMINI_API_KEY;
  const model    = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  if (!apiKey) {
    console.info('[gemini] GEMINI_API_KEY not set — using template fallback.');
    return buildTemplateScript(property, imageCount);
  }

  try {
    return await callGemini(property, imageCount, apiKey, model);
  } catch (err) {
    // Sanitize: never log the key itself, and limit error string length
    const safeMsg = String(err.message || err).slice(0, 200);
    console.warn(`[gemini] API call failed (${safeMsg}). Using template fallback.`);
    return buildTemplateScript(property, imageCount);
  }
}

// ── Internal Gemini call ─────────────────────────────────────────

async function callGemini(property, imageCount, apiKey, modelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = buildPrompt(property, imageCount);

  const result   = await model.generateContent(prompt);
  const rawText  = result.response.text().trim();

  return parseAndValidate(rawText, property, imageCount);
}

function buildPrompt(property, imageCount) {
  const {
    propertyName, location, price, propertyType,
    features, contactText, agentName, agentPhone,
  } = property;

  const featureList = (features || []).map((f, i) => `  ${i + 1}. ${f}`).join('\n');
  const contact     = agentName && agentPhone
    ? `${agentName}, ${agentPhone}`
    : contactText || 'Contact us today to schedule a visit.';

  return `
You are a professional real estate advertising copywriter.

Write a promotional video script for the property listed below.

RULES — follow every rule exactly:
1. Use ONLY the facts supplied. Do NOT add a swimming pool, gym, park, school,
   metro station, discount, legal approval, or any other detail not listed.
2. Keep every caption under 60 characters so it fits on a mobile screen.
3. Use a friendly, informative, professional tone — no hyperbole.
4. The video will have ${imageCount} scenes (images). Generate exactly
   ${imageCount} scene captions.
5. Scene 0 must be the opening (property name + location).
   Scene ${imageCount - 1} must be the closing (price + contact).
   Remaining scenes cover the features listed below.
6. Return ONLY valid JSON — no markdown fences, no extra text.

PROPERTY FACTS:
- Name:          ${propertyName}
- Location:      ${location}
- Price:         ${price}
- Type:          ${propertyType}
- Features:
${featureList}
- Contact:       ${contact}

REQUIRED JSON SHAPE:
{
  "openingTitle": "<≤10 word headline>",
  "voiceOver":    "<2–4 sentence promotional summary using only the facts above>",
  "scenes": [
    { "sceneIndex": 0,   "caption": "<≤60 chars>", "type": "opening"  },
    { "sceneIndex": 1,   "caption": "<≤60 chars>", "type": "feature"  },
    ...
    { "sceneIndex": ${imageCount - 1}, "caption": "<≤60 chars>", "type": "closing" }
  ],
  "callToAction": "<one sentence using the contact details above>"
}
`.trim();
}

/**
 * Parse the Gemini response string and validate its structure.
 * Throws if the response cannot be parsed or is missing required fields.
 */
function parseAndValidate(rawText, property, imageCount) {
  // Strip accidental markdown code fences
  const clean = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Gemini returned non-JSON response.');
  }

  // Validate required top-level fields
  const required = ['openingTitle', 'voiceOver', 'scenes', 'callToAction'];
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`Gemini response missing field: ${field}`);
    }
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('Gemini response has no scenes array.');
  }

  // Normalise scenes array length to imageCount
  while (parsed.scenes.length < imageCount) {
    const idx  = parsed.scenes.length;
    const feat = (property.features || [])[idx - 1] || `Scene ${idx + 1}`;
    parsed.scenes.push({
      sceneIndex: idx,
      caption:    feat.slice(0, 60),
      type:       'feature',
    });
  }
  parsed.scenes = parsed.scenes.slice(0, imageCount);

  // Ensure each scene has required sub-fields
  parsed.scenes = parsed.scenes.map((s, i) => ({
    sceneIndex: typeof s.sceneIndex === 'number' ? s.sceneIndex : i,
    caption:    typeof s.caption    === 'string' ? s.caption.slice(0, 60) : `Scene ${i + 1}`,
    type:       s.type || 'feature',
  }));

  return { ...parsed, source: 'gemini' };
}
