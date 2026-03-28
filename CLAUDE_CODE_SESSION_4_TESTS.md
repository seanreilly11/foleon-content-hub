# Claude Code — Session 4: Testing

This session adds comprehensive tests to the already-built backend.
Read `01_BACKEND.md` for the full test file contents before writing anything.

## Context

The backend is already built and running. You are adding tests only —
do not modify any source files unless a test reveals a genuine bug.

## Install test dependencies first

```bash
cd backend
npm install -D supertest @types/supertest
```

## Files to create (in this order)

1. `tests/fixtures.ts`              ← shared mock data, used by all test files
2. `tests/cosine.test.ts`           ← pure math, no mocks needed
3. `tests/cacheService.test.ts`     ← TTL, eviction, similarity threshold
4. `tests/sanitizer.test.ts`        ← OpenAI mocked, two-pass strategy
5. `tests/vectorStore.test.ts`      ← build, searchByVector, includeDeleted flag
6. `tests/searchService.test.ts`    ← cache miss/hit, recycle bin, embed-once
7. `tests/validate.test.ts`         ← middleware, field errors, next() behaviour
8. `tests/response.test.ts`         ← ok() and sendError() envelope shapes
9. `tests/publications.route.test.ts` ← supertest, filtering, pagination, 503
10. `tests/search.route.test.ts`    ← supertest, Zod validation, cacheHit passthrough
11. `tests/meta.route.test.ts`      ← supertest, distinct sorted values, 503

All test file contents are fully specified in `01_BACKEND.md`.

## Critical rules

1. **`tests/fixtures.ts` first** — every other test file imports from it.
   Never duplicate fixture data between test files.

2. **Mock at the right boundary:**
   - `vectorStore.test.ts` — mock `openai.embeddings.create` and `withRetry`
   - `searchService.test.ts` — mock `vectorStore` and `cacheService` entirely
   - `sanitizer.test.ts` — mock `openai.chat.completions.create` and `withRetry`
   - Route tests — mock services, use `supertest` against real Express app instance

3. **Route tests use `supertest`** — create a fresh Express app in each test file,
   register only the router under test. Do not import `app.ts` (it runs bootstrap).

4. **`withRetry` is always mocked** in tests that call services — replace with
   `jest.fn((fn) => fn())` so tests don't wait for backoff delays.

5. **Never test implementation details** — test behaviour and outputs, not which
   internal methods were called (except where call count is the explicit behaviour
   being tested, e.g. "OpenAI called exactly twice").

6. **`beforeEach` resets all mocks** — use `jest.clearAllMocks()` or
   `cacheService.clear()` to prevent test pollution.

7. **`searchService.test.ts` must verify the embed-once guarantee** — confirm
   `vectorStore.embedText` is called exactly once per `semanticSearch` call,
   regardless of cache hit or miss.

## Run after each file

```bash
npm test -- --testPathPattern=<filename>
```

Run all tests at the end:
```bash
npm test
```

All tests must pass with zero failures before this session is complete.

## What good tests prove here

- **cosine.test.ts** — the math at the heart of semantic search is correct
- **cacheService.test.ts** — the 95% threshold, TTL, and eviction work correctly
- **searchService.test.ts** — the embed-once guarantee, cache bypass for deleted search
- **vectorStore.test.ts** — deleted docs are excluded/included based on flag
- **route tests** — the API contract is correct — right status codes, right envelope shape, right validation errors
- **validate/response tests** — the shared infrastructure is reliable

These tests cover every acceptance criterion the interviewer will manually test.
