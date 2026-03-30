import { cosineSimilarity } from "../lib/cosine";
import { SearchResult, CacheEntry } from "../types";

const SIMILARITY_THRESHOLD = 0.95;
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Note: In production, if the underlying publications are updated (e.g. via POST /api/refresh),
// call cacheService.clear() to invalidate stale results. TTL handles organic expiry.

interface StringEntry {
    results: SearchResult[];
    timestamp: number;
}

export class CacheService {
    private cache: CacheEntry[] = [];
    private stringCache: Map<string, StringEntry> = new Map();

    // ─── Vector cache ────────────────────────────────────────────────────────────
    // Handles near-duplicate queries — different text, near-identical embedding.
    // e.g. "help" already cached, "help!" misses string cache but hits here.
    // Still requires an embedding API call; only the vector search is skipped.

    lookup(queryVector: number[]): SearchResult[] | null {
        const now = Date.now();
        for (const entry of this.cache) {
            if (now - entry.timestamp > CACHE_TTL_MS) continue;
            if (
                cosineSimilarity(queryVector, entry.queryVector) >=
                SIMILARITY_THRESHOLD
            ) {
                return entry.results;
            }
        }
        return null;
    }

    store(queryVector: number[], results: SearchResult[]): void {
        const now = Date.now();
        // Purge all expired entries before checking capacity — prevents them from
        // triggering premature FIFO eviction of still-valid entries.
        this.cache = this.cache.filter(
            (e) => now - e.timestamp <= CACHE_TTL_MS,
        );
        if (this.cache.length >= MAX_CACHE_SIZE) {
            this.cache.shift(); // FIFO eviction of oldest valid entry
        }
        // Store a copy — prevents external mutation from corrupting the cached entry.
        this.cache.push({ queryVector, results: [...results], timestamp: now });
    }

    // ─── String cache ────────────────────────────────────────────────────────────
    // Fast path: exact normalised query match skips the embedding API call entirely.
    // This is the primary cache — the vector cache is a fallback for near-duplicates.

    lookupString(normalizedQuery: string): SearchResult[] | null {
        const entry = this.stringCache.get(normalizedQuery);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
            this.stringCache.delete(normalizedQuery);
            return null;
        }
        return entry.results;
    }

    storeString(normalizedQuery: string, results: SearchResult[]): void {
        const now = Date.now();
        // Purge all expired entries — consistent with vector cache eviction strategy.
        for (const [key, entry] of this.stringCache) {
            if (now - entry.timestamp > CACHE_TTL_MS) {
                this.stringCache.delete(key);
            }
        }
        // Only evict for new keys — updating an existing key doesn't grow the cache.
        if (
            !this.stringCache.has(normalizedQuery) &&
            this.stringCache.size >= MAX_CACHE_SIZE
        ) {
            // FIFO eviction — Map preserves insertion order.
            const firstKey = this.stringCache.keys().next().value;
            if (firstKey !== undefined) this.stringCache.delete(firstKey);
        }
        // Store a copy — prevents external mutation from corrupting the cached entry.
        this.stringCache.set(normalizedQuery, {
            results: [...results],
            timestamp: now,
        });
    }

    // ─── Shared ──────────────────────────────────────────────────────────────────

    /** Invalidate all cached results. Call after data refresh. */
    clear(): void {
        this.cache = [];
        this.stringCache.clear();
    }

    /** Total number of live entries across both caches. */
    size(): number {
        return this.cache.length + this.stringCache.size;
    }
}

export const cacheService = new CacheService();
