import { sendOk, sendError } from '../src/lib/response';
import { Response } from 'express';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('sendOk()', () => {
  it('returns success: true with data', () => {
    const res = mockRes();
    sendOk(res, { items: [] });
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [] });
    expect(body.error).toBeNull();
  });

  it('includes pagination when provided', () => {
    const res = mockRes();
    const pagination = { page: 1, limit: 20, total: 100, totalPages: 5 };
    sendOk(res, { items: [] }, { pagination });
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.pagination).toEqual(pagination);
  });

  it('sets pagination to null when not provided', () => {
    const res = mockRes();
    sendOk(res, { ready: true });
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.pagination).toBeNull();
  });

  it('defaults to HTTP 200', () => {
    const res = mockRes();
    sendOk(res, {});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses provided status code', () => {
    const res = mockRes();
    sendOk(res, {}, { status: 201 });
    expect(res.status).toHaveBeenCalledWith(201);
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
