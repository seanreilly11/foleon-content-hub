import { Router, Request, Response, NextFunction } from 'express';
import { semanticSearch } from '../services/searchService';
import { vectorStore } from '../services/vectorStore';
import { validate } from '../lib/validate';
import { sendOk, sendError } from '../lib/response';
import { searchRequestSchema } from '../schemas';
import type { SearchRequest } from '../types';

const router = Router();

router.post(
  '/',
  validate(searchRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!vectorStore.isReady()) {
      return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
    }

    const { query, includeDeleted } = req.body as SearchRequest;

    try {
      const { items, cacheHit, latencyMs } = await semanticSearch(query, includeDeleted);
      return sendOk(res, { items, cacheHit, latencyMs });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
