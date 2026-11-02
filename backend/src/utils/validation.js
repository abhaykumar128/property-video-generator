/**
 * validation.js
 * Zod schemas for all incoming request bodies.
 *
 * scriptRequestSchema  — POST /api/scripts/generate
 * videoRequestSchema   — parsed "data" field in POST /api/videos/generate
 */

import { z } from 'zod';

// ── Script / video request schema ────────────────────────────────
// Field names match the assignment spec exactly.
export const scriptRequestSchema = z.object({
  propertyName: z.string().min(2).max(120),
  location:     z.string().min(2).max(200),
  price:        z.string().min(1).max(60),
  propertyType: z.string().min(2).max(80),

  features: z
    .array(z.string().min(1).max(120))
    .min(1, 'Provide at least one feature.')
    .max(12),

  // Optional enrichment
  description:  z.string().max(1000).optional(),
  contactText:  z.string().max(200).optional(),
  agentName:    z.string().max(100).optional(),
  agentPhone:   z.string().max(30).optional(),
  agentEmail:   z.string().email().optional(),
});

// The video request embeds the same property schema
export const videoRequestSchema = scriptRequestSchema;
