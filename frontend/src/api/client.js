/**
 * client.js
 * Thin fetch wrapper with consistent error handling.
 * All API modules import from here instead of calling fetch directly.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

/**
 * Perform a JSON request.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function apiRequest(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch (networkErr) {
    throw new Error(
      'Cannot reach the backend server. Make sure it is running on localhost:4000.'
    );
  }

  let body;
  const ct = res.headers.get('content-type') ?? '';
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    throw new Error(`Server returned an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg =
      (typeof body === 'object' ? body?.error : body) ||
      `Request failed with status ${res.status}`;
    const err  = new Error(msg);
    err.status = res.status;
    err.body   = body;
    throw err;
  }

  return body;
}

/**
 * Upload multipart/form-data (let browser set Content-Type + boundary).
 */
export async function apiUpload(path, formData) {
  return apiRequest(path, { method: 'POST', body: formData });
}
