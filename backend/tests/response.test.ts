import { ok, sendError } from '../src/lib/response';
import { Response } from 'express';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('ok()', () => {
  it('returns success: true with data', () => {
    const result = ok({ items: [] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ items: [] });
    expect(result.error).toBeNull();
  });

  it('includes pagination when provided', () => {
    const pagination = { page: 1, limit: 20, total: 100, totalPages: 5 };
    const result = ok({ items: [] }, { pagination });
    expect(result.pagination).toEqual(pagination);
  });

  it('sets pagination to null when not provided', () => {
    const result = ok({ ready: true });
    expect(result.pagination).toBeNull();
  });
});

describe('sendError()', () => {
  it('sets correct HTTP status', () => {
    const res = mockRes();
    sendError(res, 400, 'Bad request', 'VALIDATION_ERROR');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns success: false with error object', () => {
    const res = mockRes();
    sendError(res, 400, 'Bad request', 'VALIDATION_ERROR');
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('Bad request');
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('omits code when not provided', () => {
    const res = mockRes();
    sendError(res, 500, 'Server error');
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBeUndefined();
  });
});
