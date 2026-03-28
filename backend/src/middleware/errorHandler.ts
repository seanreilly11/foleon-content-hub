import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);
  // Use the envelope shape even for unhandled errors so the frontend
  // can always rely on the same success/error structure
  res.status(500).json({
    success: false,
    data: null,
    pagination: null,
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
