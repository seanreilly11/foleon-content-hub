import request from "supertest";
import express from "express";
import searchRouter from "../src/routes/search";
import { vectorStore } from "../src/services/vectorStore";
import { semanticSearch } from "../src/services/searchService";
import { mockSearchResults } from "./fixtures";

jest.mock("../src/services/vectorStore", () => ({
    vectorStore: { isReady: jest.fn() },
}));

jest.mock("../src/services/searchService", () => ({
    semanticSearch: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/search", searchRouter);

describe("POST /api/search", () => {
    beforeEach(() => {
        (vectorStore.isReady as jest.Mock).mockReturnValue(true);
        (semanticSearch as jest.Mock).mockResolvedValue({
            items: mockSearchResults,
            cacheHit: false,
            latencyMs: 120,
        });
    });

    it("returns 503 when store not ready", async () => {
        (vectorStore.isReady as jest.Mock).mockReturnValue(false);
        const res = await request(app)
            .post("/api/search")
            .send({ query: "test", includeDeleted: false });
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("NOT_READY");
    });

    it("returns 200 with ok() envelope on valid request", async () => {
        const res = await request(app)
            .post("/api/search")
            .send({ query: "success story", includeDeleted: false });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty("items");
        expect(res.body.data).toHaveProperty("cacheHit");
        expect(res.body.data).toHaveProperty("latencyMs");
    });

    it("returns 400 with VALIDATION_ERROR for empty query", async () => {
        const res = await request(app)
            .post("/api/search")
            .send({ query: "", includeDeleted: false });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for query over 500 characters", async () => {
        const res = await request(app)
            .post("/api/search")
            .send({ query: "a".repeat(501), includeDeleted: false });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when includeDeleted is not a boolean", async () => {
        const res = await request(app)
            .post("/api/search")
            .send({ query: "test", includeDeleted: "yes" });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when query is missing", async () => {
        const res = await request(app)
            .post("/api/search")
            .send({ includeDeleted: false });
        expect(res.status).toBe(400);
    });

    it("defaults includeDeleted to false when omitted from body", async () => {
        await request(app).post("/api/search").send({ query: "test" });
        expect(semanticSearch).toHaveBeenCalledWith("test", false);
    });

    it("passes includeDeleted to semanticSearch", async () => {
        await request(app)
            .post("/api/search")
            .send({ query: "deleted doc", includeDeleted: true });
        expect(semanticSearch).toHaveBeenCalledWith("deleted doc", true);
    });

    it("returns cacheHit: true when cache hit occurs", async () => {
        (semanticSearch as jest.Mock).mockResolvedValue({
            items: mockSearchResults,
            cacheHit: true,
            latencyMs: 12,
        });
        const res = await request(app)
            .post("/api/search")
            .send({ query: "success story", includeDeleted: false });
        expect(res.body.data.cacheHit).toBe(true);
    });
});
