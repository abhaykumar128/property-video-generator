/**
 * promptBuilder.service.js
 * Builds the internal creative prompt for Gemini Omni video generation
 * from the user's property data and image count.
 *
 * The user never sees or edits this prompt — the application constructs
 * all creative direction automatically.
 *
 * The prompt follows the Gemini Omni Flash prompt guide:
 *   - Uses timecode syntax [Xs-Ys] for scene timing
 *   - Uses <FIRST_FRAME> and <IMAGE_REF_N> tags to bind images to roles
 *   - Includes explicit creative direction (cinematic, photorealistic)
 *   - Includes negative prompts (no cartoon, no wireframe, etc.)
 *   - Describes audio
 */

/**
 * @param {object} property  Validated property object
 * @param {number} imageCount Number of uploaded images (4–8)
 * @returns {object} { initialPrompt, extensionPrompts[] }
 */
export function buildVideoPrompts(property, imageCount) {
  const {
    propertyName,
    location,
    price,
    propertyType,
    features = [],
    contactText = 'Contact us to schedule a visit',
  } = property;

  // ── Calculate scene timing for initial generation (~8s) ────────
  const INITIAL_DURATION = 8; // seconds for first generation
  const sceneDur = INITIAL_DURATION / imageCount;

  // ── Build scene descriptions with image reference tags ────────
  const scenes = [];

  // Scene 0: Opening — first image as FIRST_FRAME
  scenes.push(
    `[0-${sceneDur.toFixed(1)}s] <FIRST_FRAME> Establishing exterior shot of ${propertyName}, ` +
    `a ${propertyType} in ${location}. Slow cinematic dolly-in toward the property. ` +
    `Natural daylight, photorealistic, professional real estate cinematography.`
  );

  // Feature scenes: remaining images as IMAGE_REF references
  for (let i = 1; i < imageCount - 1; i++) {
    const feature = features[(i - 1) % features.length] || `property area ${i}`;
    const startT = (i * sceneDur).toFixed(1);
    const endT   = ((i + 1) * sceneDur).toFixed(1);
    scenes.push(
      `[${startT}-${endT}s] <IMAGE_REF_${i - 1}> Interior view showing ${feature}. ` +
      `Gentle horizontal pan with smooth gimbal movement. ` +
      `Preserve the room layout, walls, windows, furniture, and materials as shown in the reference image. ` +
      `Natural lighting, photorealistic.`
    );
  }

  // Closing scene: last image
  if (imageCount > 1) {
    const lastStart = ((imageCount - 1) * sceneDur).toFixed(1);
    const lastEnd   = (imageCount * sceneDur).toFixed(1);
    const lastFeature = features[(imageCount - 2) % features.length] || 'the property';
    scenes.push(
      `[${lastStart}-${lastEnd}s] <IMAGE_REF_${imageCount - 2}> Final view of ${lastFeature}. ` +
      `Slow pull-back shot. Golden hour lighting. ` +
      `Photorealistic, professional real estate commercial.`
    );
  }

  // ── Build reference declarations ───────────────────────────────
  // First image is FIRST_FRAME, rest are IMAGE_REF_0, IMAGE_REF_1, ...
  const refDecls = imageCount > 1
    ? Array.from({ length: imageCount - 1 }, (_, i) => `<IMAGE_REF_${i}>@Image${i + 2}`).join(' ')
    : '';

  const sourcesDecl = `[# Sources <FIRST_FRAME>@Image1]`;
  const refsDecl    = refDecls ? ` [# References ${refDecls}]` : '';

  // ── Build the full initial prompt ─────────────────────────────
  const initialPrompt = `${sourcesDecl}${refsDecl}

Create a professional, photorealistic real estate promotional video for ${propertyName}, a ${propertyType} located in ${location}, priced at ${price}.

CREATIVE DIRECTION:
- Professional real estate commercial cinematography
- Natural lighting, realistic materials, authentic architectural details
- Smooth cinematic camera movement: slow gimbal movements, gentle dolly-ins, controlled pans, tasteful perspective changes
- No unnecessary people or distracting activity
- No cartoon, illustration, wireframe, floor-plan, empty grid, gradient placeholder, or artificial room-template visuals
- Preserve the architectural geometry, walls, windows, doors, fixtures, furniture, flooring, colors, and materials shown in the reference images
- Do not change room geometry, invent additional rooms, or add unsupported amenities

SCENE SEQUENCE:
${scenes.join('\n')}

AUDIO: Calm ambient atmosphere with gentle instrumental background music. No dialogue.

Use Image1 as the starting frame. Use the remaining images as references for the property's appearance and layout. The reference images should guide the visual style — the video should show realistic, smooth camera movement through the property as if captured by a professional camera operator.`;

  // ── Build extension prompts ───────────────────────────────────
  // Each extension continues the property tour with the same style
  const extensionPrompts = [
    `Continue the property tour with the same cinematic style. ` +
    `Show additional interior details and rooms with smooth gimbal movement. ` +
    `Maintain visual continuity with the previous footage. ` +
    `Natural lighting, photorealistic. No dialogue. Calm ambient audio continues.`,

    `Continue the property tour. Show the final rooms and outdoor areas. ` +
    `Slow cinematic pans, gentle dolly movements. ` +
    `End with a wide establishing shot of the property exterior. ` +
    `Golden hour lighting. No dialogue. Calm ambient audio continues.`,
  ];

  return { initialPrompt, extensionPrompts };
}
