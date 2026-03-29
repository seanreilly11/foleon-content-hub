import { cosineSimilarity } from '../lib/cosine';
import { SearchResult, CacheEntry } from '../types';

const SIMILARITY_THRESHOLD = 0.95;
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Note: In production, if the underlying publications are updated (e.g. via POST /api/refresh),
// call cacheService.clear() to invalidate stale results. TTL handles organic expiry.

interface StringEntry {
  results: SearchResult[];
  timestamp: number;
}

class CacheService {
  private cache: CacheEntry[] = [];
  private stringCache: Map<string, StringEntry> = new Map();

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

  /** Exact string lookup — checked before embedding to avoid unnecessary API calls. */
  lookupString(normalizedQuery: string): SearchResult[] | null {
    const entry = this.stringCache.get(normalizedQuery);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.stringCache.delete(normalizedQuery);
      return null;
    }
    return entry.results;
  }

  /** Store results keyed by exact normalised query string. */
  storeString(normalizedQuery: string, results: SearchResult[]): void {
    this.stringCache.set(normalizedQuery, { results, timestamp: Date.now() });
  }

  /** Invalidate all cached results. Call after data refresh. */
  clear(): void {
    this.cache = [];
    this.stringCache.clear();
  }

  size(): number {
    return this.cache.length;
  }
}

export const cacheService = new CacheService();
