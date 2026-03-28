import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../lib/api';
import type { ApiResult } from '../lib/api';
import { searchDataSchema } from '../schemas';
import type { SearchData, SearchRequest } from '../schemas';

export type { SearchRequest };

export function useSearchMutation() {
  // useMutation<TData, TError, TVariables>
  // TData is ApiResult<SearchData> — { data: { items, cacheHit, latencyMs }, pagination: null }
  return useMutation<ApiResult<SearchData>, Error, SearchRequest>({
    mutationFn: (body) => apiPost('/api/search', body, searchDataSchema),
  });
}
