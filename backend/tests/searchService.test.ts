import { semanticSearch } from '../src/services/searchService';
import { cacheService } from '../src/services/cacheService';
import { vectorStore } from '../src/services/vectorStore';
import { mockSearchResults } from './fixtures';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    embedText: jest.fn(),
    searchByVector: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../src/services/cacheService', () => ({
  cacheService: {
    lookup: jest.fn(),
    store: jest.fn(),
    clear: jest.fn(),
    size: jest.fn().mockReturnValue(0),
  },
}));

const mockVector = new Array(1536).fill(0.1);

describe('semanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vectorStore.embedText as jest.Mock).mockResolvedValue(mockVector);
    (vectorStore.searchByVector as jest.Mock).mockReturnValue(mockSearchResults);
    (cacheService.lookup as jest.Mock).mockReturnValue(null);
  });

  describe('cache miss', () => {
    it('embeds the query once', async () => {
      await semanticSearch('success story');
      expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
      expect(vectorStore.embedText).toHaveBeenCalledWith('success story');
    });

    it('checks cache before searching', async () => {
      await semanticSearch('success story');
      expect(cacheService.lookup).toHaveBeenCalledWith(mockVector);
      expect(cacheService.lookup).toHaveBeenCalledBefore(
        vectorStore.searchByVector as jest.Mock
      );
    });

    it('calls searchByVector with the pre-computed vector', async () => {
      await semanticSearch('success story');
      expect(vectorStore.searchByVector).toHaveBeenCalledWith(mockVector, 10, false);
    });

    it('stores results in cache after search', async () => {
      await semanticSearch('success story');
      expect(cacheService.store).toHaveBeenCalledWith(mockVector, mockSearchResults);
    });

    it('returns cacheHit: false', async () => {
      const result = await semanticSearch('success story');
      expect(result.cacheHit).toBe(false);
    });

    it('returns a positive latencyMs', async () => {
      const result = await semanticSearch('success story');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns the search results', async () => {
      const result = await semanticSearch('success story');
      expect(result.results).toEqual(mockSearchResults);
    });
  });

  describe('cache hit', () => {
    beforeEach(() => {
      (cacheService.lookup as jest.Mock).mockReturnValue(mockSearchResults);
    });

    it('returns cacheHit: true', async () => {
      const result = await semanticSearch('success story');
      expect(result.cacheHit).toBe(true);
    });

    it('does not call searchByVector on cache hit', async () => {
      await semanticSearch('success story');
      expect(vectorStore.searchByVector).not.toHaveBeenCalled();
    });

    it('does not store in cache again on cache hit', async () => {
      await semanticSearch('success story');
      expect(cacheService.store).not.toHaveBeenCalled();
    });

    it('still embeds the query — needed to check cache', async () => {
      await semanticSearch('success story');
      expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
    });
  });

  describe('recycle bin mode (includeDeleted: true)', () => {
    it('passes includeDeleted: true to searchByVector', async () => {
      await semanticSearch('deleted report', true);
      expect(vectorStore.searchByVector).toHaveBeenCalledWith(mockVector, 10, true);
    });

    it('does not check the cache in recycle bin mode', async () => {
      await semanticSearch('deleted report', true);
      expect(cacheService.lookup).not.toHaveBeenCalled();
    });

    it('does not store results in cache in recycle bin mode', async () => {
      await semanticSearch('deleted report', true);
      expect(cacheService.store).not.toHaveBeenCalled();
    });
  });
});
