import { useState, useCallback } from 'react';
import { useSearchMutation } from './useSearchMutation';
import type { SearchData } from '../schemas';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [results, setResults] = useState<SearchData | null>(null);

  const { mutate, isPending, error } = useSearchMutation();

  const onSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) {
        setSubmittedQuery(trimmed);
        mutate({ query: trimmed, includeDeleted }, {
          onSuccess: (data) => setResults(data.data ?? null),
        });
      } else {
        setSubmittedQuery('');
        setResults(null);
      }
    },
    [mutate, includeDeleted],
  );

  const handleIncludeDeletedChange = useCallback(
    (value: boolean) => {
      setIncludeDeleted(value);
      if (submittedQuery) {
        mutate({ query: submittedQuery, includeDeleted: value }, {
          onSuccess: (data) => setResults(data.data ?? null),
        });
      }
    },
    [mutate, submittedQuery],
  );

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setIncludeDeleted(false);
    setResults(null);
  };

  return {
    query,
    setQuery,
    onSearch,
    results,
    isLoading: isPending,
    error: error instanceof Error ? error.message : null,
    clearSearch,
    includeDeleted,
    setIncludeDeleted: handleIncludeDeletedChange,
  };
}
