import { useState, useEffect } from 'react';
import { useSearchMutation } from './useSearchMutation';
import { useDebounce } from './useDebounce';
import { SEARCH_DEBOUNCE_MS } from '../constants';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const { mutate, data: mutationData, isPending, error, reset } = useSearchMutation();

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Fire search automatically when the debounced query changes.
  // The user doesn't need to press Enter — typing naturally triggers search
  // after SEARCH_DEBOUNCE_MS of inactivity.
  useEffect(() => {
    if (debouncedQuery.trim()) {
      mutate({ query: debouncedQuery.trim(), includeDeleted });
    } else {
      reset();
    }
  }, [debouncedQuery, includeDeleted, mutate, reset]);

  const clearSearch = () => {
    setQuery('');
    setIncludeDeleted(false);
    reset();
  };

  const handleIncludeDeletedChange = (value: boolean) => {
    setIncludeDeleted(value);
    // The useEffect re-runs immediately when includeDeleted changes (it's in the
    // dependency array), so no direct mutate() call is needed here — that would
    // fire a second identical request.
  };

  // mutationData is ApiResult<SearchData> — envelope already unwrapped by apiPost
  // results?.data is SearchData: { items, cacheHit, latencyMs }
  return {
    query,
    setQuery,
    results: mutationData?.data ?? null,
    isLoading: isPending,
    error: error instanceof Error ? error.message : null,
    clearSearch,
    includeDeleted,
    setIncludeDeleted: handleIncludeDeletedChange,
  };
}
