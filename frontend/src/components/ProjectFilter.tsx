import React from 'react';
import { useFetchMeta } from '../hooks/useFetchMeta';
import { getCategoryDot } from '../constants';

interface Props {
  selectedProject: string;
  selectedCategory: string;
  onProjectChange: (p: string) => void;
  onCategoryChange: (c: string) => void;
  totalCount: number;
}

// ProjectFilter fetches its own metadata — fully self-contained.
// App.tsx does not need to pass projects/categories as props.
export const ProjectFilter: React.FC<Props> = ({
  selectedProject,
  selectedCategory,
  onProjectChange,
  onCategoryChange,
  totalCount,
}) => {
  const { data } = useFetchMeta();
  // data is ApiResult<MetaData> — envelope unwrapped, access via data.data
  const projects = data?.data?.projects ?? [];
  const categories = data?.data?.categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Category
        </p>
        <button
          onClick={() => onCategoryChange('')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left ${
            !selectedCategory
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>All</span>
          <span className="text-xs text-gray-400 tabular-nums">{totalCount}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left ${
              selectedCategory === cat
                ? 'bg-brand-50 text-brand-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${getCategoryDot(cat)}`} />
            <span>{cat}</span>
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
          Project
        </p>
        <button
          onClick={() => onProjectChange('')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left ${
            !selectedProject
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>All Projects</span>
        </button>
        {projects.map((project) => (
          <button
            key={project}
            onClick={() => onProjectChange(project)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              selectedProject === project
                ? 'bg-brand-50 text-brand-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {project}
          </button>
        ))}
      </div>
    </div>
  );
};
