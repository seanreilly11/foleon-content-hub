import React from 'react';
import type { SearchData } from '../types';

interface Props {
  response: SearchData;
  inRecycleBin: boolean;
}

export const StatusBanner: React.FC<Props> = ({ response, inRecycleBin }) => {
  if (inRecycleBin) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-fit">
        <span>🗑️</span>
        <span className="font-semibold">Recycle bin search</span>
        <span className="text-red-400">— {response.items.length} deleted results in {response.latencyMs}ms</span>
      </div>
    );
  }

  if (response.cacheHit) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 w-fit">
        <span>⚡</span>
        <span className="font-semibold">Instant result</span>
        <span className="text-emerald-500">— served from semantic cache in {response.latencyMs}ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-4 py-2 w-fit">
      <span>🔍</span>
      <span className="font-semibold">Semantic search</span>
      <span className="text-brand-500">— {response.items.length} results in {response.latencyMs}ms</span>
    </div>
  );
};
