import React from "react";
import { useFetchMeta } from "../hooks/useFetchMeta";
import { getCategoryDot } from "../constants";
import { FilterButton } from "./ui";
import { Button } from "./ui/Button";

interface Props {
    selectedProject: string;
    selectedCategory: string;
    onProjectChange: (p: string) => void;
    onCategoryChange: (c: string) => void;
    totalCount: number;
}

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
            <Button
                variant="ghost"
                size="sm"
                className="w-full text-gray-500 hover:text-gray-700"
                disabled={!selectedProject && !selectedCategory}
                onClick={() => {
                    onProjectChange("");
                    onCategoryChange("");
                }}
            >
                Clear filters
            </Button>
            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    Category
                </p>
                <FilterButton
                    selected={!selectedCategory}
                    onClick={() => onCategoryChange("")}
                    className="justify-between"
                >
                    <span>All</span>
                    <span className="text-xs text-gray-400 tabular-nums">
                        {totalCount}
                    </span>
                </FilterButton>
                {categories.map((cat) => (
                    <FilterButton
                        key={cat}
                        selected={selectedCategory === cat}
                        onClick={() => onCategoryChange(cat)}
                    >
                        <span
                            className={`w-2 h-2 rounded-full shrink-0 ${getCategoryDot(cat)}`}
                        />
                        <span>{cat}</span>
                    </FilterButton>
                ))}
            </div>

            <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    Project
                </p>
                <FilterButton
                    selected={!selectedProject}
                    onClick={() => onProjectChange("")}
                >
                    All Projects
                </FilterButton>
                {projects.map((project) => (
                    <FilterButton
                        key={project}
                        selected={selectedProject === project}
                        onClick={() => onProjectChange(project)}
                    >
                        {project}
                    </FilterButton>
                ))}
            </div>
        </div>
    );
};
