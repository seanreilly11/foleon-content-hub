import { Router, Request, Response, NextFunction } from 'express';
import { sanitizePublications, parseRawPublications } from '../services/sanitizer';
import { vectorStore } from '../services/vectorStore';
import { cacheService } from '../services/cacheService';
import { sendOk, sendError } from '../lib/response';
import { env } from '../lib/env';
import rawData from '../data/publications.raw.json';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  // Simple admin key guard — in production use a proper auth layer
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return sendError(res, 401, 'Unauthorised', 'UNAUTHORISED');
  }

  console.log('\n[Refresh] Manual refresh triggered...');
  const start = Date.now();

  try {
    const raw = parseRawPublications(rawData);
    const healed = await sanitizePublications(raw);
    await vectorStore.build(healed);

    // Invalidate cache — results based on old data are now stale
    cacheService.clear();
    console.log('[Refresh] Cache invalidated.');

    return sendOk(res, {
      publicationCount: healed.length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
