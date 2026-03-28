import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { ok, sendError } from '../lib/response';
import { Pagination } from '../types';

const router = Router();

const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 20;

router.get('/', (req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT));
  const projectFilter = req.query.project as string | undefined;
  const categoryFilter = req.query.category as string | undefined;

  let all = vectorStore.getAll();

  if (projectFilter) {
    all = all.filter((p) => p.project.toLowerCase() === projectFilter.toLowerCase());
  }
  if (categoryFilter) {
    all = all.filter((p) => p.category.toLowerCase() === categoryFilter.toLowerCase());
  }

  const total = all.length;
  const totalPages = Math.ceil(total / limit);

  if (page > totalPages && totalPages > 0) {
    return sendError(res, 400, `Page ${page} out of range. Total pages: ${totalPages}`, 'PAGE_OUT_OF_RANGE');
  }

  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);

  const pagination: Pagination = { page, limit, total, totalPages };
  return res.json(ok({ items }, { pagination }));
});

export default router;
