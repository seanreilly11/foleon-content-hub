import { useState, useCallback } from 'react';
import { useFetchPublications } from './useFetchPublications';
import type { Publication, BrowseSort } from '../types';

export function usePublications() {
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState<BrowseSort>('date-desc');

  const { data, isLoading, error } = useFetchPublications({
    page,
    project: selectedProject,
    category: selectedCategory,
    sort,
  });

  // data is ApiResult<PublicationsData> — envelope already unwrapped by apiGet
  const publications: Publication[] = data?.data?.items ?? [];
  const pagination = data?.pagination ?? null;

  const handleProjectChange = useCallback((p: string) => {
    setSelectedProject(p);
    setPage(1);
    setSort('date-desc');
  }, []);

  const handleCategoryChange = useCallback((c: string) => {
    setSelectedCategory(c);
    setPage(1);
    setSort('date-desc');
  }, []);

  return {
    publications,
    total: pagination?.total ?? 0,
    totalPages: pagination?.totalPages ?? 0,
    page,
    setPage,
    selectedProject,
    setSelectedProject: handleProjectChange,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    sort,
    setSort,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
