import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { sendOk, sendError } from '../lib/response';
import { Pagination, BrowseSort, BROWSE_SORT_VALUES } from '../types';

const router = Router();

const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 20;

router.get('/', (req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT));
  const project = req.query.project as string | undefined;
  const category = req.query.category as string | undefined;
  const sortParam = req.query.sort as string | undefined;
  const sort: BrowseSort = BROWSE_SORT_VALUES.includes(sortParam as BrowseSort)
    ? (sortParam as BrowseSort)
    : 'date-desc';

  const { items, total, totalPages } = vectorStore.listPublications({ project, category, sort, page, limit });

  if (page > totalPages && totalPages > 0) {
    return sendError(res, 400, `Page ${page} out of range. Total pages: ${totalPages}`, 'PAGE_OUT_OF_RANGE');
  }

  const pagination: Pagination = { page, limit, total, totalPages };
  return sendOk(res, { items }, { pagination });
});

export default router;
