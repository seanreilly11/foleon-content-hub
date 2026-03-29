import { vectorStore } from './vectorStore';
import { cacheService } from './cacheService';
import { SearchResponse } from '../types';


/**
 * @param includeDeleted - When true, search includes deleted publications
 *   ("recycle bin" mode). Cached results are keyed separately per mode.
 */
export async function semanticSearch(
  query: string,
  includeDeleted = false
): Promise<SearchResponse> {
  const start = Date.now();

  // Normalise before embedding — "Client Testimonial" and "client testimonial"
  // must produce the same vector so the cache can match them.
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  // Fast path: exact string match skips the embedding call entirely.
  // Only used for standard searches — recycle bin results are never cached.
  if (!includeDeleted) {
    const stringHit = cacheService.lookupString(normalizedQuery);
    if (stringHit) {
      return { results: stringHit, cacheHit: true, latencyMs: Date.now() - start };
    }
  }

  // Embed the query ONCE — reuse for both vector cache lookup and vector search
  const queryVector = await vectorStore.embedText(normalizedQuery);

  // Slow path: vector similarity cache (handles near-identical queries)
  if (!includeDeleted) {
    const cached = cacheService.lookup(queryVector);
    if (cached) {
      // Promote to string cache so the next identical query skips embedding
      cacheService.storeString(normalizedQuery, cached);
      return { results: cached, cacheHit: true, latencyMs: Date.now() - start };
    }
  }

  const results = vectorStore.searchByVector(queryVector, includeDeleted);

  // Only cache standard searches — recycle bin results are niche and not worth caching
  if (!includeDeleted) {
    cacheService.store(queryVector, results);
    cacheService.storeString(normalizedQuery, results);
  }

  return { results, cacheHit: false, latencyMs: Date.now() - start };
}
