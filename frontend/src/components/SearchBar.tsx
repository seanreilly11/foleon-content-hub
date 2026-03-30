import React from "react";
import { Input, IconButton, Button } from "./ui";
import { SEARCH_MAX_LENGTH } from "../constants";

interface Props {
    query: string;
    onChange: (q: string) => void;
    onSearch: (q: string) => void;
    onClear: () => void;
    loading: boolean;
}

const SearchIcon = () => (
    <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
    >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

const ClearIcon = () => (
    <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
    >
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
);

export const SearchBar: React.FC<Props> = ({
    query,
    onChange,
    onSearch,
    onClear,
    loading,
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") onSearch(query);
        if (e.key === "Escape") onClear();
    };

    const rightSlot = (
        <>
            {loading && (
                <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            )}
            {query && !loading && (
                <IconButton onClick={onClear} aria-label="Clear search">
                    <ClearIcon />
                </IconButton>
            )}
            <Button
                variant="primary"
                size="sm"
                onClick={() => onSearch(query)}
                disabled={!query.trim() || loading}
            >
                Search
            </Button>
        </>
    );

    return (
        <div className="relative w-full max-w-2xl mx-auto">
            <Input
                type="text"
                value={query}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Search: "success story", "developer guide", "revenue"...'
                maxLength={SEARCH_MAX_LENGTH}
                aria-label="Semantic search"
                leftSlot={<SearchIcon />}
                rightSlot={rightSlot}
            />
        </div>
    );
};
