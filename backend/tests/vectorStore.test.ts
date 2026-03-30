import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';

jest.mock('../src/lib/openai', () => ({
  openai: {
    embeddings: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));

import { openai } from '../src/lib/openai';

// Generate a mock embedding response for N inputs
function mockEmbeddingResponse(n: number) {
  return {
    data: Array.from({ length: n }, (_, i) => ({
      embedding: new Array(1536).fill(i * 0.1),
    })),
  };
}

describe('VectorStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store between tests by rebuilding
  });

  describe('build', () => {
    it('isReady() returns false before build is called', () => {
      jest.resetModules();
      jest.mock('../src/lib/openai', () => ({
        openai: { embeddings: { create: jest.fn() } },
      }));
      jest.mock('../src/lib/retry', () => ({
        withRetry: jest.fn((fn: () => unknown) => fn()),
      }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { vectorStore: freshStore } = require('../src/services/vectorStore');
      expect(freshStore.isReady()).toBe(false);
    });

    it('isReady() returns false during a rebuild — prevents concurrent access to partial store', async () => {
      // First build — store becomes ready
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );
      await vectorStore.build(mockPublications);
      expect(vectorStore.isReady()).toBe(true);

      // Second build — hold the embedding promise open so we can inspect mid-build
      let resolveEmbedding!: (value: unknown) => void;
      (openai.embeddings.create as jest.Mock).mockReturnValue(
        new Promise((resolve) => { resolveEmbedding = resolve; })
      );

      const buildPromise = vectorStore.build(mockPublications);

      // isReady() must be false while the rebuild is in progress
      expect(vectorStore.isReady()).toBe(false);

      // Unblock the embedding and let the build complete
      resolveEmbedding(mockEmbeddingResponse(mockPublications.length));
      await buildPromise;

      expect(vectorStore.isReady()).toBe(true);
    });

    it('embeds all publications in batches', async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );

      await vectorStore.build(mockPublications);

      expect(openai.embeddings.create).toHaveBeenCalled();
      expect(vectorStore.isReady()).toBe(true);
    });

    it('stores all publications after build', async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );

      await vectorStore.build(mockPublications);
      expect(vectorStore.getAll()).toHaveLength(mockPublications.length);
    });
  });

  describe('searchByVector', () => {
    beforeEach(async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );
      await vectorStore.build(mockPublications);
    });

    it('throws if called before build', () => {
      // Reset modules to get a fresh unbuilt singleton
      jest.resetModules();
      jest.mock('../src/lib/openai', () => ({
        openai: { embeddings: { create: jest.fn() } },
      }));
      jest.mock('../src/lib/retry', () => ({
        withRetry: jest.fn((fn: () => unknown) => fn()),
      }));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { vectorStore: freshStore } = require('../src/services/vectorStore');
      expect(() => freshStore.searchByVector([1, 0], false)).toThrow('Store not built yet');
    });

    it('returns results sorted by score descending', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, false);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('only returns results at or above the minimum score threshold', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, false);
      results.forEach((r) => expect(r.score).toBeGreaterThanOrEqual(0.35));
    });

    it('excludes deleted publications when includeDeleted: false', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, false);
      const statuses = results.map((r) => r.publication.status);
      expect(statuses).not.toContain('deleted');
    });

    it('includes deleted publications when includeDeleted: true', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, true);
      const hasDeleted = results.some((r) => r.publication.status === 'deleted');
      expect(hasDeleted).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(
        vectorStore.searchByVector(queryVec, false).length
      );
    });
  });
});
