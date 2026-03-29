import { useState, useCallback, useEffect } from 'react';
import { useSearchMutation } from './useSearchMutation';
import type { SearchData, SearchResult, SearchSort } from '../types';

function applySearchSort(items: SearchResult[], sort: SearchSort): SearchResult[] {
  if (sort === 'relevance') return items;
  const sorted = [...items];
  if (sort === 'date-desc') sorted.sort((a, b) => b.publication.created_at.localeCompare(a.publication.created_at));
  if (sort === 'date-asc')  sorted.sort((a, b) => a.publication.created_at.localeCompare(b.publication.created_at));
  if (sort === 'title-asc') sorted.sort((a, b) => a.publication.title.localeCompare(b.publication.title));
  if (sort === 'title-desc') sorted.sort((a, b) => b.publication.title.localeCompare(a.publication.title));
  return sorted;
}

export function useSearch() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [searchSort, setSearchSort] = useState<SearchSort>('relevance');
  const [results, setResults] = useState<SearchData | null>(null);

  const { mutate, isPending, error } = useSearchMutation();

  // Re-sort when sort changes without a new API call
  useEffect(() => {
    if (results) {
      setResults((prev) =>
        prev ? { ...prev, items: applySearchSort(prev.items, searchSort) } : null,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchSort]);

  const onSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) {
        setSubmittedQuery(trimmed);
        mutate({ query: trimmed, includeDeleted }, {
          onSuccess: (data) => {
            const items = applySearchSort(data.data?.items ?? [], searchSort);
            setResults(data.data ? { ...data.data, items } : null);
          },
        });
      } else {
        setSubmittedQuery('');
        setResults(null);
      }
    },
    [mutate, includeDeleted, searchSort],
  );

  const handleIncludeDeletedChange = useCallback(
    (value: boolean) => {
      setIncludeDeleted(value);
      if (submittedQuery) {
        mutate({ query: submittedQuery, includeDeleted: value }, {
          onSuccess: (data) => {
            const items = applySearchSort(data.data?.items ?? [], searchSort);
            setResults(data.data ? { ...data.data, items } : null);
          },
        });
      }
    },
    [mutate, submittedQuery, searchSort],
  );

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setIncludeDeleted(false);
    setSearchSort('relevance');
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
    searchSort,
    setSearchSort,
  };
}
