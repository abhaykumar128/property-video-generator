/**
 * scripts.controller.js
 * POST /api/scripts/generate
 *
 * Accepts property JSON, generates and returns a promotional script.
 * Does NOT start video rendering — script generation only.
 */

import { scriptRequestSchema } from '../utils/validation.js';
import { generateScript }      from '../services/gemini.service.js';

export async function generateScriptHandler(req, res, next) {
  try {
    // Validate request body
    const parsed = scriptRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        error:  'Validation failed.',
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    // Default imageCount to the length of features + 2 (opening + closing)
    // when called standalone (not as part of a video job).
    const imageCount = Number(req.body.imageCount) || parsed.data.features.length + 2;

    const script = await generateScript(parsed.data, imageCount);

    return res.json({
      success: true,
      script,
    });
  } catch (err) {
    next(err);
  }
}
