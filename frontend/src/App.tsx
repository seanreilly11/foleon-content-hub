import { SearchBar } from './components/SearchBar';
import { PublicationList } from './components/PublicationList';
import { ProjectFilter } from './components/ProjectFilter';
import { StatusBanner } from './components/StatusBanner';
import { RecycleBinToggle } from './components/RecycleBinToggle';
import { InitialisingScreen } from './components/InitialisingScreen';
import { useServerReady } from './hooks/useServerReady';
import { usePublications } from './hooks/usePublications';
import { useSearch } from './hooks/useSearch';

export default function App() {
  const { ready, startupStage } = useServerReady();

  const {
    publications, total, totalPages,
    page, setPage, selectedProject, setSelectedProject,
    selectedCategory, setSelectedCategory, isLoading: pubsLoading, error: pubsError,
  } = usePublications();

  const {
    query, setQuery,
    results: searchResults,
    isLoading: searchLoading,
    error: searchError,
    clearSearch,
    includeDeleted,
    setIncludeDeleted,
  } = useSearch();

  const isSearchMode = searchResults !== null;
  const loading = pubsLoading || searchLoading;

  // Show initialising screen until backend AI pipeline is complete
  if (!ready) return <InitialisingScreen stage={startupStage} />;

  return (
    <div className="min-h-screen bg-surface font-sans">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-900">Content Hub</span>
          </div>
          <span className="text-sm text-gray-400 font-medium tabular-nums">{total} publications</span>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-3">
          {/* onSearch sets query immediately (Enter / button), debounce in useSearch fires the API call */}
          <SearchBar
            query={query}
            onChange={setQuery}
            onSearch={setQuery}
            onClear={clearSearch}
            loading={searchLoading}
          />
          <div className="flex items-center gap-3 flex-wrap">
            {searchResults && (
              <StatusBanner response={searchResults} inRecycleBin={includeDeleted} />
            )}
            {isSearchMode && (
              <RecycleBinToggle enabled={includeDeleted} onChange={setIncludeDeleted} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {!isSearchMode && (
          <aside className="w-52 shrink-0">
            {/* ProjectFilter fetches its own metadata via useFetchMeta —
                no need to pass projects/categories as props */}
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
              {selectedProject || selectedCategory ? 'Filtered results' : 'All publications'}
              {' · '}
              <span className="font-medium text-gray-700">{total} total</span>
            </p>
          )}
          <PublicationList
            publications={isSearchMode ? undefined : publications}
            searchResults={isSearchMode ? (searchResults?.items ?? []) : undefined}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            isSearchMode={isSearchMode}
          />
        </main>
      </div>
    </div>
  );
}
