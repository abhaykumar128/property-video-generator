/**
 * template.service.js
 * Deterministic, template-based script generator.
 *
 * Used when:
 *   - GEMINI_API_KEY is not set
 *   - The Gemini API call fails or returns unusable data
 *
 * Produces the same output shape as the Gemini path so the rest of
 * the pipeline never needs to branch on which generator was used.
 *
 * RULE: never invent facts not present in the supplied property data.
 */

/**
 * @param {object} property  Validated property object
 * @param {number} imageCount  Number of uploaded images
 * @returns {object} script
 */
export function buildTemplateScript(property, imageCount) {
  const {
    propertyName,
    location,
    price,
    propertyType,
    features    = [],
    contactText = 'Contact us today to schedule a visit.',
    agentName,
    agentPhone,
  } = property;

  // ── Opening ───────────────────────────────────────────────────
  const openingTitle = `${propertyName} — ${propertyType} in ${location}`;

  // ── Voice-over summary ───────────────────────────────────────
  const featureList = features.slice(0, 6).join(', ');
  const voiceOver =
    `Presenting ${propertyName}, a ${propertyType} located in ${location}, ` +
    `available at ${price}. ` +
    (featureList ? `Key features include: ${featureList}. ` : '') +
    `This is a wonderful opportunity for anyone looking for a quality home.`;

  // ── Scene captions ────────────────────────────────────────────
  // Scene 0: opening — property name + location
  // Scenes 1…N-2: one caption per feature (cycling if more images than features)
  // Scene N-1: closing — price + CTA
  const scenes = [];

  // Opening scene
  scenes.push({
    sceneIndex: 0,
    caption:    `${propertyName} · ${location}`,
    type:       'opening',
  });

  // Feature scenes
  const featureSceneCount = Math.max(0, imageCount - 2);
  for (let i = 0; i < featureSceneCount; i++) {
    const feature = features[i % features.length] || `Feature ${i + 1}`;
    scenes.push({
      sceneIndex: i + 1,
      caption:    feature,
      type:       'feature',
    });
  }

  // Closing scene
  scenes.push({
    sceneIndex: scenes.length,
    caption:    `Priced at ${price}`,
    type:       'closing',
  });

  // ── Call to action ────────────────────────────────────────────
  let callToAction = contactText;
  if (agentName && agentPhone) {
    callToAction = `Call ${agentName} on ${agentPhone} to schedule a visit.`;
  } else if (agentName) {
    callToAction = `Contact ${agentName} to schedule a visit.`;
  }

  return {
    openingTitle,
    voiceOver,
    scenes,
    callToAction,
    source: 'template',
  };
}
