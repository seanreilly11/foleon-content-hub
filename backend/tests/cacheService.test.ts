import { cacheService } from '../src/services/cacheService';
import { mockSearchResults, unitVector } from './fixtures';

describe('CacheService', () => {
  beforeEach(() => cacheService.clear());

  describe('lookup', () => {
    it('returns null on empty cache', () => {
      expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
    });

    it('returns results on exact vector match', () => {
      const vec = unitVector(4, 0);
      cacheService.store(vec, mockSearchResults);
      expect(cacheService.lookup(vec)).toEqual(mockSearchResults);
    });

    it('returns results for query ≥ 0.95 cosine similarity', () => {
      // Nearly identical vectors — will be above threshold
      const stored = [1, 0.001, 0, 0];
      const similar = [1, 0.002, 0, 0];
      cacheService.store(stored, mockSearchResults);
      expect(cacheService.lookup(similar)).toEqual(mockSearchResults);
    });

    it('returns null for orthogonal vector (similarity = 0)', () => {
      cacheService.store(unitVector(4, 0), mockSearchResults);
      expect(cacheService.lookup(unitVector(4, 1))).toBeNull();
    });

    it('returns null for expired entries (TTL)', () => {
      const vec = unitVector(4, 0);
      cacheService.store(vec, mockSearchResults);
      // Backdate timestamp past TTL
      const entry = (cacheService as unknown as {
        cache: Array<{ timestamp: number }>
      }).cache[0];
      entry.timestamp = Date.now() - (61 * 60 * 1000);
      expect(cacheService.lookup(vec)).toBeNull();
    });
  });

  describe('store', () => {
    it('increments size on each store', () => {
      expect(cacheService.size()).toBe(0);
      cacheService.store(unitVector(4, 0), mockSearchResults);
      expect(cacheService.size()).toBe(1);
      cacheService.store(unitVector(4, 1), mockSearchResults);
      expect(cacheService.size()).toBe(2);
    });

    it('evicts oldest entry when MAX_CACHE_SIZE is reached', () => {
      const MAX = 500;
      // Fill to capacity
      for (let i = 0; i < MAX; i++) {
        const vec = new Array(4).fill(0);
        vec[i % 4] = i + 1; // ensure unique-ish vectors
        cacheService.store(vec, mockSearchResults);
      }
      expect(cacheService.size()).toBe(MAX);

      // Add one more — oldest should be evicted
      cacheService.store([99, 0, 0, 0], mockSearchResults);
      expect(cacheService.size()).toBe(MAX);
    });
  });

  describe('clear', () => {
    it('empties the cache', () => {
      cacheService.store(unitVector(4, 0), mockSearchResults);
      cacheService.clear();
      expect(cacheService.size()).toBe(0);
      expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
    });
  });
});
