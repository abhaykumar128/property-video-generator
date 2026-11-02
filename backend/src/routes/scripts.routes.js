/**
 * scripts.routes.js
 * POST /api/scripts/generate
 */

import { Router }                from 'express';
import { generateScriptHandler } from '../controllers/scripts.controller.js';

const router = Router();

router.post('/generate', generateScriptHandler);

export default router;
