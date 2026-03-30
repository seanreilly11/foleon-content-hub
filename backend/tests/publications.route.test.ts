import request from 'supertest';
import express from 'express';
import publicationsRouter from '../src/routes/publications';
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';
import type { Publication } from '../src/types';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    isReady: jest.fn(),
    listPublications: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/publications', publicationsRouter);

function mockListPublications(opts: {
  project?: string;
  category?: string;
  sort?: string;
  page: number;
  limit: number;
}) {
  let pubs: Publication[] = [...mockPublications];
  if (opts.project) pubs = pubs.filter((p) => p.project.toLowerCase() === opts.project!.toLowerCase());
  if (opts.category) pubs = pubs.filter((p) => p.category.toLowerCase() === opts.category!.toLowerCase());
  if (opts.sort === 'title-asc') pubs.sort((a, b) => a.title.localeCompare(b.title));
  if (opts.sort === 'title-desc') pubs.sort((a, b) => b.title.localeCompare(a.title));
  if (opts.sort === 'date-asc') pubs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (opts.sort === 'date-desc') pubs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = pubs.length;
  const totalPages = Math.ceil(total / opts.limit);
  const start = (opts.page - 1) * opts.limit;
  return { items: pubs.slice(start, start + opts.limit), total, totalPages };
}

describe('GET /api/publications', () => {
  beforeEach(() => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(true);
    (vectorStore.listPublications as jest.Mock).mockImplementation(mockListPublications);
  });

  it('returns 503 when store not ready', async () => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/publications');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_READY');
  });

  it('returns 200 with sendOk() envelope shape', async () => {
    const res = await request(app).get('/api/publications');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.pagination).toBeDefined();
  });

  it('returns paginated items', async () => {
    const res = await request(app).get('/api/publications?page=1&limit=2');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.pagination.total).toBe(mockPublications.length);
  });

  it('filters by project', async () => {
    const res = await request(app).get('/api/publications?project=Marketing');
    const items = res.body.data.items;
    items.forEach((p: { project: string }) => {
      expect(p.project).toBe('Marketing');
    });
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/publications?category=Technical+Guides');
    const items = res.body.data.items;
    items.forEach((p: { category: string }) => {
      expect(p.category).toBe('Technical Guides');
    });
  });

  it('returns 400 when page is out of range', async () => {
    const res = await request(app).get('/api/publications?page=999');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGE_OUT_OF_RANGE');
  });

  it('returns all publications with no filters', async () => {
    const res = await request(app).get('/api/publications?limit=100');
    expect(res.body.data.items).toHaveLength(mockPublications.length);
  });

  it('passes sort=title-asc to listPublications', async () => {
    const res = await request(app).get('/api/publications?sort=title-asc&limit=100');
    expect(res.status).toBe(200);
    expect(vectorStore.listPublications).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'title-asc' }),
    );
  });

  it('defaults to date-desc for unknown sort values', async () => {
    const res = await request(app).get('/api/publications?sort=invalid');
    expect(res.status).toBe(200);
    expect(vectorStore.listPublications).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'date-desc' }),
    );
  });

  it('trims whitespace from project param before filtering', async () => {
    await request(app).get('/api/publications?project=%20Marketing%20');
    expect(vectorStore.listPublications).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'Marketing' }),
    );
  });

  it('trims whitespace from category param before filtering', async () => {
    await request(app).get('/api/publications?category=%20Technical+Guides%20');
    expect(vectorStore.listPublications).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Technical Guides' }),
    );
  });

  it('treats whitespace-only project param as no filter', async () => {
    await request(app).get('/api/publications?project=%20%20');
    expect(vectorStore.listPublications).toHaveBeenCalledWith(
      expect.objectContaining({ project: undefined }),
    );
  });
});
