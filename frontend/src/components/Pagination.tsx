import React from 'react';
import { Button, IconButton } from './ui';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const Pagination: React.FC<Props> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter((p) => p <= 3 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <div className="flex items-center gap-1 justify-center mt-8">
      <IconButton
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft />
      </IconButton>

      {visible.reduce<React.ReactNode[]>((acc, p, i, arr) => {
        if (i > 0 && p - (arr[i - 1] as number) > 1) {
          acc.push(
            <span key={`dots-${p}`} className="px-1 text-gray-300 text-sm">…</span>
          );
        }
        acc.push(
          <Button
            key={p}
            variant={p === page ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(p)}
            className="w-9 h-9 p-0"
          >
            {p}
          </Button>
        );
        return acc;
      }, [])}

      <IconButton
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight />
      </IconButton>
    </div>
  );
};
