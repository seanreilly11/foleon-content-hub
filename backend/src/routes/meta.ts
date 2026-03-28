import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { ok, sendError } from '../lib/response';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const all = vectorStore.getAll();
  const projects = Array.from(new Set(all.map((p) => p.project))).sort();
  const categories = Array.from(new Set(all.map((p) => p.category))).sort();

  return res.json(ok({ projects, categories }));
});

export default router;
