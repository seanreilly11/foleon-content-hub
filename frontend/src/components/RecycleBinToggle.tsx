import React from 'react';
import { Button } from './ui';

interface Props {
  enabled: boolean;
  onChange: (v: boolean) => void;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const RecycleBinToggle: React.FC<Props> = ({ enabled, onChange }) => (
  <Button
    variant="outline"
    size="sm"
    onClick={() => onChange(!enabled)}
    title="Include deleted publications in search results"
    className={enabled ? 'bg-red-50 border-red-200 text-red-600 hover:border-red-300' : ''}
  >
    <TrashIcon />
    {enabled ? 'Searching recycle bin' : 'Search in recycle bin'}
  </Button>
);
