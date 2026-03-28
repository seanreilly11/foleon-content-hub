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

  // Embed the query ONCE — reuse for both cache lookup and vector search
  const queryVector = await vectorStore.embedText(query);

  // Check cache — note: results are mode-specific, so we can't serve
  // a non-deleted cache result for a recycle-bin search and vice versa.
  // The simplest safe approach: only use cache for standard (non-deleted) searches.
  if (!includeDeleted) {
    const cached = cacheService.lookup(queryVector);
    if (cached) {
      return { results: cached, cacheHit: true, latencyMs: Date.now() - start };
    }
  }

  const results = vectorStore.searchByVector(queryVector, 10, includeDeleted);

  // Only cache standard searches — recycle bin results are niche and not worth caching
  if (!includeDeleted) {
    cacheService.store(queryVector, results);
  }

  return { results, cacheHit: false, latencyMs: Date.now() - start };
}
