/**
 * videoApi.js
 * Script generation and video job status.
 */

import { apiRequest } from './client.js';

/**
 * Generate a promotional script for a property.
 * Endpoint: POST /api/scripts/generate
 *
 * @param {object} property  Validated property object
 * @param {number} imageCount
 * @returns {Promise<{ script: object }>}
 */
export async function generateScript(property, imageCount) {
  return apiRequest('/api/scripts/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...property, imageCount }),
  });
}

/**
 * Poll the status of a video generation job.
 * Endpoint: GET /api/videos/jobs/:jobId
 *
 * @param {string} jobId
 * @returns {Promise<{ jobId, status, progress, script, videoUrl?, error? }>}
 */
export async function getVideoStatus(jobId) {
  return apiRequest(`/api/videos/jobs/${jobId}`);
}

/**
 * Stream URL for a completed video (used as <video src>).
 * @param {string} jobId
 */
export function getVideoStreamUrl(jobId) {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/videos/${jobId}/stream`;
}

/**
 * Download URL for a completed video.
 * @param {string} jobId
 */
export function getVideoDownloadUrl(jobId) {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/videos/${jobId}/download`;
}
