import { SearchBar } from "./components/SearchBar";
import { ContentArea } from "./components/ContentArea";
import { StatusBanner } from "./components/StatusBanner";
import { RecycleBinToggle } from "./components/RecycleBinToggle";
import { InitialisingScreen } from "./components/InitialisingScreen";
import { Navbar } from "./components/Navbar";
import { useServerReady } from "./hooks/useServerReady";
import { useSearch } from "./hooks/useSearch";

export default function App() {
    const { ready, startupStage } = useServerReady();

    const {
        query,
        setQuery,
        onSearch,
        results: searchResults,
        isLoading: searchLoading,
        error: searchError,
        clearSearch,
        includeDeleted,
        setIncludeDeleted,
        searchSort,
        setSearchSort,
    } = useSearch();

    // Show initialising screen until backend AI pipeline is complete
    if (!ready) return <InitialisingScreen stage={startupStage} />;

    return (
        <div className="min-h-screen bg-surface font-sans">
            <Navbar />

            <div className="bg-white border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-3">
                    {/* onSearch sets query immediately (Enter / button), debounce in useSearch fires the API call */}
                    <SearchBar
                        query={query}
                        onChange={setQuery}
                        onSearch={onSearch}
                        onClear={clearSearch}
                        loading={searchLoading}
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                        {searchResults && (
                            <StatusBanner
                                response={searchResults}
                                inRecycleBin={includeDeleted}
                            />
                        )}
                        {searchResults !== null && (
                            <RecycleBinToggle
                                enabled={includeDeleted}
                                onChange={setIncludeDeleted}
                            />
                        )}
                    </div>
                </div>
            </div>

            <ContentArea
                searchResults={searchResults}
                searchLoading={searchLoading}
                searchError={searchError}
                searchSort={searchSort}
                setSearchSort={setSearchSort}
            />
        </div>
    );
}
