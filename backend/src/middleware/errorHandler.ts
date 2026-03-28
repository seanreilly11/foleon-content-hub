import { Request, Response, NextFunction } from 'express';
import { sendError } from '../lib/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);
  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  sendError(res, 500, message, 'INTERNAL_ERROR');
}
