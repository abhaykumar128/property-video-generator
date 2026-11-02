/**
 * job.service.js
 * In-memory job store for video generation jobs.
 *
 * Job status lifecycle:
 *   queued → processing → completed
 *                       ↘ failed
 *
 * Shape:
 * {
 *   id:          string  (UUID)
 *   property:    object  (validated property data)
 *   files:       object[] (Multer file records)
 *   status:      'queued' | 'processing' | 'completed' | 'failed'
 *   progress:    string  (human-readable progress note)
 *   videoUrl:    string | null  (relative URL when completed)
 *   script:      object | null  (generated script)
 *   error:       string | null  (message when failed)
 *   createdAt:   string  (ISO timestamp)
 * }
 *
 * NOTE: jobs are stored in process memory only.
 * They are lost on server restart (intentional for assignment scope).
 */

import { randomUUID } from 'crypto';

/** @type {Map<string, object>} */
const jobs = new Map();

export function createJob(property, files) {
  const id  = randomUUID();
  const job = {
    id,
    property,
    files,
    status:        'queued',
    progress:      'Job created, waiting to start.',
    videoUrl:      null,
    script:        null,
    interactionId: null,
    error:         null,
    createdAt:     new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) ?? null;
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

/**
 * Remove jobs older than maxAgeMs (default: 2 hours) to cap memory use.
 * Call this on a timer in production; for the assignment it is exported
 * for manual / test use.
 */
export function pruneOldJobs(maxAgeMs = 2 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [id, job] of jobs) {
    if (new Date(job.createdAt).getTime() < cutoff) {
      jobs.delete(id);
    }
  }
}

/** Expose current job count (useful for health checks / tests). */
export function jobCount() {
  return jobs.size;
}
