import React from "react";
import type { SearchData } from "../types";
import { usePublications } from "../hooks/usePublications";
import { ProjectFilter } from "./ProjectFilter";
import { PublicationList } from "./PublicationList";

interface Props {
    searchResults: SearchData | null;
    searchLoading: boolean;
    searchError: string | null;
}

export const ContentArea: React.FC<Props> = ({
    searchResults,
    searchLoading,
    searchError,
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
                {!isSearchMode && (
                    <p className="text-sm text-gray-500 mb-4">
                        {selectedProject || selectedCategory
                            ? "Filtered results"
                            : "All publications"}
                        {" · "}
                        <span className="font-medium text-gray-700">
                            {total} total
                        </span>
                    </p>
                )}
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
