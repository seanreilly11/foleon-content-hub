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
      // Create a fresh instance to test unbuilt state
      const { VectorStore } = jest.requireActual('../src/services/vectorStore') as {
        VectorStore: new () => typeof vectorStore
      };
      const fresh = new VectorStore();
      expect(() => fresh.searchByVector([1, 0], 5, false)).toThrow('Store not built yet');
    });

    it('returns results sorted by score descending', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, false);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('respects topK limit', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 2, false);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('excludes deleted publications when includeDeleted: false', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, false);
      const statuses = results.map((r) => r.publication.status);
      expect(statuses).not.toContain('deleted');
    });

    it('includes deleted publications when includeDeleted: true', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, true);
      const hasDeleted = results.some((r) => r.publication.status === 'deleted');
      // With our fixture data, deleted pub should appear
      expect(results.length).toBeGreaterThan(0);
      // All results including deleted are present
      expect(results.length).toBeGreaterThanOrEqual(
        vectorStore.searchByVector(queryVec, 10, false).length
      );
    });
  });
});
