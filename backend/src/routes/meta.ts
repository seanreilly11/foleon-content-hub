import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { ok, sendError } from '../lib/response';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const { projects, categories } = vectorStore.getMetadata();
  return res.json(ok({ projects, categories }));
});

export default router;
