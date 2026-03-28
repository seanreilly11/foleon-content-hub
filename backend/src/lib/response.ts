import { Response } from 'express';
import { Pagination } from '../types';

interface ApiError {
  message: string;
  code?: string;
}

export interface OkOptions {
  pagination?: Pagination;
  status?: number;
}

/**
 * Send a successful response.
 * @example return sendOk(res, { items: publications }, { pagination })
 * @example return sendOk(res, { projects, categories })
 */
export function sendOk<T>(res: Response, data: T, options: OkOptions = {}) {
  return res.status(options.status ?? 200).json({
    success: true as const,
    data,
    pagination: options.pagination ?? null,
    error: null,
  });
}

/**
 * Send an error response.
 * @example return sendError(res, 400, 'query must be a non-empty string', 'VALIDATION_ERROR')
 * @example return sendError(res, 503, 'Service initialising', 'NOT_READY')
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string
) {
  return res.status(status).json({
    success: false as const,
    data: null,
    pagination: null,
    error: { message, ...(code && { code }) } satisfies ApiError,
  });
}
