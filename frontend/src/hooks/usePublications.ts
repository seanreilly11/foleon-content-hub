import { useState, useCallback } from 'react';
import { useFetchPublications } from './useFetchPublications';
import type { Publication } from '../types';

export function usePublications() {
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data, isLoading, error } = useFetchPublications({
    page,
    project: selectedProject,
    category: selectedCategory,
  });

  // data is ApiResult<PublicationsData> — envelope already unwrapped by apiGet
  const publications: Publication[] = data?.data?.items ?? [];
  const pagination = data?.pagination ?? null;

  const handleProjectChange = useCallback((p: string) => {
    setSelectedProject(p);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((c: string) => {
    setSelectedCategory(c);
    setPage(1);
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
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
