import request from 'supertest';
import express from 'express';
import metaRouter from '../src/routes/meta';
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    isReady: jest.fn(),
    getAll: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/publications/meta', metaRouter);

describe('GET /api/publications/meta', () => {
  beforeEach(() => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(true);
    (vectorStore.getAll as jest.Mock).mockReturnValue(mockPublications);
  });

  it('returns 503 when store not ready', async () => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/publications/meta');
    expect(res.status).toBe(503);
  });

  it('returns sorted distinct projects', async () => {
    const res = await request(app).get('/api/publications/meta');
    expect(res.status).toBe(200);
    const { projects } = res.body.data;
    expect(projects).toEqual([...projects].sort());
    expect(new Set(projects).size).toBe(projects.length);
  });

  it('returns sorted distinct categories', async () => {
    const res = await request(app).get('/api/publications/meta');
    const { categories } = res.body.data;
    expect(categories).toEqual([...categories].sort());
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('returns ok() envelope shape', async () => {
    const res = await request(app).get('/api/publications/meta');
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('categories');
  });
});
