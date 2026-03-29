import { useState, useCallback } from 'react';
import { useSearchMutation } from './useSearchMutation';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const { mutate, data: mutationData, isPending, error, reset } = useSearchMutation();

  const onSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) {
        setSubmittedQuery(trimmed);
        mutate({ query: trimmed, includeDeleted });
      } else {
        setSubmittedQuery('');
        reset();
      }
    },
    [mutate, reset, includeDeleted],
  );

  const handleIncludeDeletedChange = useCallback(
    (value: boolean) => {
      setIncludeDeleted(value);
      if (submittedQuery) {
        mutate({ query: submittedQuery, includeDeleted: value });
      }
    },
    [mutate, submittedQuery],
  );

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setIncludeDeleted(false);
    reset();
  };

  return {
    query,
    setQuery,
    onSearch,
    results: mutationData?.data ?? null,
    isLoading: isPending,
    error: error instanceof Error ? error.message : null,
    clearSearch,
    includeDeleted,
    setIncludeDeleted: handleIncludeDeletedChange,
  };
}
