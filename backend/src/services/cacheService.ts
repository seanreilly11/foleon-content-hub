import { cosineSimilarity } from '../lib/cosine';
import { SearchResult, CacheEntry } from '../types';

const SIMILARITY_THRESHOLD = 0.95;
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Note: In production, if the underlying publications are updated (e.g. via POST /api/refresh),
// call cacheService.clear() to invalidate stale results. TTL handles organic expiry.

class CacheService {
  private cache: CacheEntry[] = [];

  lookup(queryVector: number[]): SearchResult[] | null {
    const now = Date.now();

    for (const entry of this.cache) {
      // Evict expired entries on access rather than running a background sweep
      if (now - entry.timestamp > CACHE_TTL_MS) continue;

      if (cosineSimilarity(queryVector, entry.queryVector) >= SIMILARITY_THRESHOLD) {
        return entry.results;
      }
    }
    return null;
  }

  store(queryVector: number[], results: SearchResult[]): void {
    const now = Date.now();
    // Purge expired entries before checking capacity — prevents them from
    // triggering premature FIFO eviction of still-valid entries.
    this.cache = this.cache.filter((e) => now - e.timestamp <= CACHE_TTL_MS);
    if (this.cache.length >= MAX_CACHE_SIZE) {
      this.cache.shift(); // FIFO eviction of oldest valid entry
    }
    this.cache.push({ queryVector, results, timestamp: now });
  }

  /** Invalidate all cached results. Call after data refresh. */
  clear(): void {
    this.cache = [];
  }

  size(): number {
    return this.cache.length;
  }
}

export const cacheService = new CacheService();
