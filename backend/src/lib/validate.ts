import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from './response';

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return sendError(res, 400, message, 'VALIDATION_ERROR');
    }

    // Replace raw body with parsed, typed, coerced body
    req.body = result.data;
    return next();
  };
}
