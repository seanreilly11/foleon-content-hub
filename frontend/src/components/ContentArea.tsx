import React from "react";
import type { SearchData, BrowseSort, SearchSort } from "../types";
import { usePublications } from "../hooks/usePublications";
import { ProjectFilter } from "./ProjectFilter";
import { PublicationList } from "./PublicationList";
import { SortSelect } from "./SortSelect";

const BROWSE_SORT_OPTIONS = [
    { value: "date-desc", label: "Newest first" },
    { value: "date-asc", label: "Oldest first" },
    { value: "title-asc", label: "Title A-Z" },
    { value: "title-desc", label: "Title Z-A" },
    { value: "project-asc", label: "Project A-Z" },
    { value: "status", label: "Status" },
];

const SEARCH_SORT_OPTIONS = [
    { value: "relevance", label: "Relevance" },
    { value: "date-desc", label: "Newest first" },
    { value: "date-asc", label: "Oldest first" },
    { value: "title-asc", label: "Title A-Z" },
    { value: "title-desc", label: "Title Z-A" },
];

interface Props {
    searchResults: SearchData | null;
    searchLoading: boolean;
    searchError: string | null;
    searchSort: SearchSort;
    setSearchSort: (s: SearchSort) => void;
}

export const ContentArea: React.FC<Props> = ({
    searchResults,
    searchLoading,
    searchError,
    searchSort,
    setSearchSort,
}) => {
    const {
        publications,
        total,
        totalPages,
        page,
        setPage,
        selectedProject,
        setSelectedProject,
        selectedCategory,
        setSelectedCategory,
        sort,
        setSort,
        isLoading: pubsLoading,
        error: pubsError,
    } = usePublications();

    const isSearchMode = searchResults !== null;
    const loading = pubsLoading || searchLoading;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
            {!isSearchMode && (
                <aside className="w-52 shrink-0">
                    <ProjectFilter
                        selectedProject={selectedProject}
                        selectedCategory={selectedCategory}
                        onProjectChange={setSelectedProject}
                        onCategoryChange={setSelectedCategory}
                        totalCount={total}
                    />
                </aside>
            )}

            <main className="flex-1 min-w-0">
                {(pubsError || searchError) && (
                    <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
                        {pubsError ?? searchError}
                    </div>
                )}
                <div className="flex items-center justify-between mb-4">
                    {!isSearchMode && (
                        <p className="text-sm text-gray-500">
                            {selectedProject || selectedCategory
                                ? "Filtered results"
                                : "All publications"}
                            {" · "}
                            <span className="font-medium text-gray-700">
                                {total} total
                            </span>
                        </p>
                    )}
                    {isSearchMode && <div />}
                    {isSearchMode ? (
                        <SortSelect
                            value={searchSort}
                            onChange={(v) => setSearchSort(v as SearchSort)}
                            options={SEARCH_SORT_OPTIONS}
                        />
                    ) : (
                        <SortSelect
                            value={sort}
                            onChange={(v) => setSort(v as BrowseSort)}
                            options={BROWSE_SORT_OPTIONS}
                        />
                    )}
                </div>
                <PublicationList
                    publications={isSearchMode ? undefined : publications}
                    searchResults={
                        isSearchMode ? (searchResults!.items ?? []) : undefined
                    }
                    loading={loading}
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    isSearchMode={isSearchMode}
                />
            </main>
        </div>
    );
};
