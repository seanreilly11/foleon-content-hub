import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../src/lib/validate';

function mockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

const testSchema = z.object({
  query: z.string().min(1),
  count: z.number().optional(),
});

describe('validate middleware', () => {
  it('calls next() with valid body', () => {
    const { req, res, next } = mockReqRes({ query: 'hello' });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('replaces req.body with parsed (coerced) data', () => {
    const { req, res, next } = mockReqRes({ query: 'hello' });
    validate(testSchema)(req, res, next);
    expect(req.body).toEqual({ query: 'hello' });
  });

  it('returns 400 with VALIDATION_ERROR code on invalid body', () => {
    const { req, res, next } = mockReqRes({ query: '' });
    validate(testSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('VALIDATION_ERROR');
    expect(next).not.toHaveBeenCalled();
  });

  it('includes field path in error message', () => {
    const { req, res, next } = mockReqRes({ query: '' });
    validate(testSchema)(req, res, next);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error.message).toContain('query');
  });

  it('returns 400 when body is missing entirely', () => {
    const { req, res, next } = mockReqRes(undefined);
    validate(testSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
