/**
 * propertyApi.js
 * Submit property details + images.
 * Endpoint: POST /api/videos/generate   (multipart/form-data)
 *
 * The backend expects the property object as a JSON string in
 * the "data" field alongside the "images" file array.
 */

import { apiUpload } from './client.js';

/**
 * @param {object}   property  Validated property object (propertyName, location, …)
 * @param {File[]}   images    Array of image File objects
 * @returns {Promise<{ jobId: string }>}
 */
export async function submitProperty(property, images) {
  const form = new FormData();
  form.append('data', JSON.stringify(property));
  images.forEach((file) => form.append('images', file));
  return apiUpload('/api/videos/generate', form);
}
