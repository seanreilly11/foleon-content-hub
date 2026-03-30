import { semanticSearch } from "../src/services/searchService";
import { cacheService } from "../src/services/cacheService";
import { vectorStore } from "../src/services/vectorStore";
import { mockSearchResults } from "./fixtures";

jest.mock("../src/services/vectorStore", () => ({
    vectorStore: {
        embedText: jest.fn(),
        searchByVector: jest.fn(),
        isReady: jest.fn().mockReturnValue(true),
    },
}));

jest.mock("../src/services/cacheService", () => ({
    cacheService: {
        lookup: jest.fn(),
        store: jest.fn(),
        lookupString: jest.fn(),
        storeString: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
    },
}));

const mockVector = new Array(1536).fill(0.1);

describe("semanticSearch", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vectorStore.embedText as jest.Mock).mockResolvedValue(mockVector);
        (vectorStore.searchByVector as jest.Mock).mockReturnValue(
            mockSearchResults,
        );
        (cacheService.lookup as jest.Mock).mockReturnValue(null);
    });

    describe("cache miss", () => {
        it("embeds the query once", async () => {
            await semanticSearch("success story");
            expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
            expect(vectorStore.embedText).toHaveBeenCalledWith("success story");
        });

        it("checks cache before searching", async () => {
            await semanticSearch("success story");
            expect(cacheService.lookup).toHaveBeenCalledWith(mockVector);
            // mocks toHaveBeenCalledBefore
            const lookupOrder = (cacheService.lookup as jest.Mock).mock
                .invocationCallOrder[0];
            const searchOrder = (vectorStore.searchByVector as jest.Mock).mock
                .invocationCallOrder[0];
            expect(lookupOrder).toBeLessThan(searchOrder);
        });

        it("calls searchByVector with the pre-computed vector", async () => {
            await semanticSearch("success story");
            expect(vectorStore.searchByVector).toHaveBeenCalledWith(
                mockVector,
                false,
            );
        });

        it("stores results in cache after search", async () => {
            await semanticSearch("success story");
            expect(cacheService.store).toHaveBeenCalledWith(
                mockVector,
                mockSearchResults,
            );
        });

        it("returns cacheHit: false", async () => {
            const result = await semanticSearch("success story");
            expect(result.cacheHit).toBe(false);
        });

        it("returns a positive latencyMs", async () => {
            const result = await semanticSearch("success story");
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        });

        it("returns the search results", async () => {
            const result = await semanticSearch("success story");
            expect(result.results).toEqual(mockSearchResults);
        });
    });

    describe("vector cache hit", () => {
        beforeEach(() => {
            (cacheService.lookup as jest.Mock).mockReturnValue(
                mockSearchResults,
            );
        });

        it("returns cacheHit: true", async () => {
            const result = await semanticSearch("success story");
            expect(result.cacheHit).toBe(true);
        });

        it("does not call searchByVector on cache hit", async () => {
            await semanticSearch("success story");
            expect(vectorStore.searchByVector).not.toHaveBeenCalled();
        });

        it("does not store in cache again on cache hit", async () => {
            await semanticSearch("success story");
            expect(cacheService.store).not.toHaveBeenCalled();
        });

        it("still embeds the query — needed to check vector cache", async () => {
            await semanticSearch("success story");
            expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
        });
    });

    describe("string cache hit (fast path)", () => {
        beforeEach(() => {
            (cacheService.lookupString as jest.Mock).mockReturnValue(
                mockSearchResults,
            );
        });

        it("returns cacheHit: true without calling embedText", async () => {
            const result = await semanticSearch("success story");
            expect(result.cacheHit).toBe(true);
            expect(vectorStore.embedText).not.toHaveBeenCalled();
        });

        it("does not call searchByVector", async () => {
            await semanticSearch("success story");
            expect(vectorStore.searchByVector).not.toHaveBeenCalled();
        });

        it("uses the lowercased query as the string cache key", async () => {
            await semanticSearch("SUCCESS STORY");
            expect(cacheService.lookupString).toHaveBeenCalledWith("success story");
        });
    });

    describe("query normalisation", () => {
        it("punctuation is preserved in the cache key (near-duplicates handled by vector cache)", async () => {
            (cacheService.lookupString as jest.Mock).mockReturnValueOnce(null);
            await semanticSearch("help");
            expect(cacheService.storeString).toHaveBeenCalledWith("help", mockSearchResults);

            // "help!" has a different string cache key — no false hit
            (cacheService.lookupString as jest.Mock).mockReturnValueOnce(null);
            await semanticSearch("help!");
            expect(cacheService.lookupString).toHaveBeenLastCalledWith("help!");
            // Both calls embed — the vector cache (tested separately) handles near-duplicates
            expect(vectorStore.embedText).toHaveBeenCalledTimes(2);
        });

        it("uppercase and lowercase of the same query share the same string cache entry", async () => {
            // First call (lowercase) — cache miss, embeds, stores
            (cacheService.lookupString as jest.Mock).mockReturnValueOnce(null);
            await semanticSearch("success story");
            expect(cacheService.storeString).toHaveBeenCalledWith(
                "success story",
                mockSearchResults,
            );

            // Second call (uppercase) — should hit the same string cache key
            (cacheService.lookupString as jest.Mock).mockReturnValueOnce(
                mockSearchResults,
            );
            const result = await semanticSearch("SUCCESS STORY");
            expect(cacheService.lookupString).toHaveBeenLastCalledWith(
                "success story",
            );
            expect(result.cacheHit).toBe(true);
            // embedText called only for the first (cache-miss) call
            expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
        });
    });

    describe("recycle bin mode (includeDeleted: true)", () => {
        it("passes includeDeleted: true to searchByVector", async () => {
            await semanticSearch("deleted report", true);
            expect(vectorStore.searchByVector).toHaveBeenCalledWith(
                mockVector,
                true,
            );
        });

        it("does not check the cache in recycle bin mode", async () => {
            await semanticSearch("deleted report", true);
            expect(cacheService.lookup).not.toHaveBeenCalled();
        });

        it("does not store results in cache in recycle bin mode", async () => {
            await semanticSearch("deleted report", true);
            expect(cacheService.store).not.toHaveBeenCalled();
        });
    });
});
