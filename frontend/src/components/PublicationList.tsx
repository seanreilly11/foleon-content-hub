import React from 'react';
import type { Publication, SearchResult } from '../types';
import { PublicationCard } from './PublicationCard';
import { SkeletonCard } from './SkeletonCard';
import { Pagination } from './Pagination';

interface Props {
  publications?: Publication[];
  searchResults?: SearchResult[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  isSearchMode: boolean;
}

export const PublicationList: React.FC<Props> = ({
  publications,
  searchResults,
  loading,
  page,
  totalPages,
  onPageChange,
  isSearchMode,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isSearchMode && searchResults !== undefined) {
    if (searchResults.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium text-gray-600">No results found</p>
          <p className="text-sm mt-1">Try a different search term or browse all publications</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {searchResults.map(({ publication, score }) => (
          <PublicationCard key={publication.id} publication={publication} score={score} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {(publications ?? []).map((pub) => (
          <PublicationCard key={pub.id} publication={pub} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
};
