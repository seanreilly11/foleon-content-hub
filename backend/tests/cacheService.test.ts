import { CacheService } from "../src/services/cacheService";
import { mockSearchResults, unitVector } from "./fixtures";

describe("CacheService", () => {
    // Use a fresh instance per test so tests are fully isolated.
    let cacheService: CacheService;
    beforeEach(() => {
        cacheService = new CacheService();
    });
    // ─── Vector cache ─────────────────────────────────────────────────────────

    describe("vector cache — lookup", () => {
        it("returns null on empty cache", () => {
            expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
        });

        it("returns results on exact vector match", () => {
            const vec = unitVector(4, 0);
            cacheService.store(vec, mockSearchResults);
            expect(cacheService.lookup(vec)).toEqual(mockSearchResults);
        });

        it("returns results for query ≥ 0.95 cosine similarity", () => {
            const stored = [1, 0.001, 0, 0];
            const similar = [1, 0.002, 0, 0];
            cacheService.store(stored, mockSearchResults);
            expect(cacheService.lookup(similar)).toEqual(mockSearchResults);
        });

        it("returns null for vector with similarity just below 0.95", () => {
            // [1,0,0,0] vs [1,0.4,0,0] → cosine ≈ 0.928, which is < 0.95
            const stored = [1, 0, 0, 0];
            const justBelow = [1, 0.4, 0, 0];
            cacheService.store(stored, mockSearchResults);
            expect(cacheService.lookup(justBelow)).toBeNull();
        });

        it("returns null for orthogonal vector (similarity = 0)", () => {
            cacheService.store(unitVector(4, 0), mockSearchResults);
            expect(cacheService.lookup(unitVector(4, 1))).toBeNull();
        });

        it("returns null for expired entries (TTL)", () => {
            const vec = unitVector(4, 0);
            cacheService.store(vec, mockSearchResults);
            (
                cacheService as unknown as {
                    cache: Array<{ timestamp: number }>;
                }
            ).cache[0].timestamp = Date.now() - 61 * 60 * 1000;
            expect(cacheService.lookup(vec)).toBeNull();
        });

        it("stored results are a defensive copy — external mutation does not corrupt cache", () => {
            const results = [...mockSearchResults];
            cacheService.store(unitVector(4, 0), results);
            results.splice(0); // mutate the original array
            expect(cacheService.lookup(unitVector(4, 0))).toEqual(
                mockSearchResults,
            );
        });
    });

    describe("vector cache — store", () => {
        it("increments size on each store", () => {
            expect(cacheService.size()).toBe(0);
            cacheService.store(unitVector(4, 0), mockSearchResults);
            expect(cacheService.size()).toBe(1);
            cacheService.store(unitVector(4, 1), mockSearchResults);
            expect(cacheService.size()).toBe(2);
        });

        it("evicts oldest entry when MAX_CACHE_SIZE is reached", () => {
            const MAX = 500;
            for (let i = 0; i < MAX; i++) {
                const vec = new Array(4).fill(0);
                vec[i % 4] = i + 1;
                cacheService.store(vec, mockSearchResults);
            }
            expect(cacheService.size()).toBe(MAX);
            cacheService.store([99, 0, 0, 0], mockSearchResults);
            expect(cacheService.size()).toBe(MAX);
        });
    });

    // ─── String cache ──────────────────────────────────────────────────────────

    describe("string cache — lookupString", () => {
        it("returns null on empty cache", () => {
            expect(cacheService.lookupString("query")).toBeNull();
        });

        it("returns results for an exact string match", () => {
            cacheService.storeString("success story", mockSearchResults);
            expect(cacheService.lookupString("success story")).toEqual(
                mockSearchResults,
            );
        });

        it("returns null for a different string", () => {
            cacheService.storeString("success story", mockSearchResults);
            expect(cacheService.lookupString("case study")).toBeNull();
        });

        it("returns null for expired entries (TTL)", () => {
            cacheService.storeString("query", mockSearchResults);
            const stringCache = (
                cacheService as unknown as {
                    stringCache: Map<string, { timestamp: number }>;
                }
            ).stringCache;
            stringCache.get("query")!.timestamp = Date.now() - 61 * 60 * 1000;
            expect(cacheService.lookupString("query")).toBeNull();
        });

        it("removes the expired entry on lookup", () => {
            cacheService.storeString("query", mockSearchResults);
            const stringCache = (
                cacheService as unknown as {
                    stringCache: Map<string, { timestamp: number }>;
                }
            ).stringCache;
            stringCache.get("query")!.timestamp = Date.now() - 61 * 60 * 1000;
            cacheService.lookupString("query");
            expect(stringCache.has("query")).toBe(false);
        });

        it("stored results are a defensive copy — external mutation does not corrupt cache", () => {
            const results = [...mockSearchResults];
            cacheService.storeString("query", results);
            results.splice(0);
            expect(cacheService.lookupString("query")).toEqual(
                mockSearchResults,
            );
        });
    });

    describe("string cache — storeString", () => {
        it("increments size on each new key", () => {
            expect(cacheService.size()).toBe(0);
            cacheService.storeString("query-a", mockSearchResults);
            expect(cacheService.size()).toBe(1);
            cacheService.storeString("query-b", mockSearchResults);
            expect(cacheService.size()).toBe(2);
        });

        it("does not increment size when updating an existing key", () => {
            cacheService.storeString("query", mockSearchResults);
            expect(cacheService.size()).toBe(1);
            cacheService.storeString("query", mockSearchResults);
            expect(cacheService.size()).toBe(1);
        });

        it("evicts oldest entry (FIFO) when MAX_CACHE_SIZE is reached", () => {
            const MAX = 500;
            for (let i = 0; i < MAX; i++) {
                cacheService.storeString(`query-${i}`, mockSearchResults);
            }
            expect(cacheService.size()).toBe(MAX);

            cacheService.storeString("new-query", mockSearchResults);
            expect(cacheService.size()).toBe(MAX);
            expect(cacheService.lookupString("query-0")).toBeNull(); // first in, first out
            expect(cacheService.lookupString("new-query")).toEqual(
                mockSearchResults,
            );
        });

        it("purges all expired entries before checking capacity", () => {
            const MAX = 500;
            for (let i = 0; i < MAX; i++) {
                cacheService.storeString(`query-${i}`, mockSearchResults);
            }
            // Expire all entries
            const stringCache = (
                cacheService as unknown as {
                    stringCache: Map<string, { timestamp: number }>;
                }
            ).stringCache;
            for (const entry of stringCache.values()) {
                entry.timestamp = Date.now() - 61 * 60 * 1000;
            }
            // Adding a new entry should clear expired ones first — no eviction of valid entries
            cacheService.storeString("fresh-query", mockSearchResults);
            expect(cacheService.lookupString("fresh-query")).toEqual(
                mockSearchResults,
            );
            expect(cacheService.size()).toBe(1);
        });
    });

    // ─── Shared ────────────────────────────────────────────────────────────────

    describe("size", () => {
        it("reflects entries across both caches", () => {
            cacheService.store(unitVector(4, 0), mockSearchResults);
            cacheService.storeString("query", mockSearchResults);
            expect(cacheService.size()).toBe(2);
        });
    });

    describe("clear", () => {
        it("empties the vector cache", () => {
            cacheService.store(unitVector(4, 0), mockSearchResults);
            cacheService.clear();
            expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
        });

        it("empties the string cache", () => {
            cacheService.storeString("query", mockSearchResults);
            cacheService.clear();
            expect(cacheService.lookupString("query")).toBeNull();
        });

        it("resets size to 0", () => {
            cacheService.store(unitVector(4, 0), mockSearchResults);
            cacheService.storeString("query", mockSearchResults);
            cacheService.clear();
            expect(cacheService.size()).toBe(0);
        });
    });
});
