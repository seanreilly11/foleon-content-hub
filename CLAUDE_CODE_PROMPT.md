# Claude Code — Build Instructions for Foleon Content Hub (v3)

You are building a fullstack application called **Foleon Content Hub**.

Read ALL spec files before writing any code:
- `00_ARCHITECTURE.md` — structure, types, design decisions
- `01_BACKEND.md` — complete backend implementation
- `02_FRONTEND.md` — complete frontend implementation
- `03_README.md` — README content

The raw data file will be provided separately — save it to
`backend/src/data/publications.raw.json`.

---

## Build Order

### Step 1 — Root scaffold
Create `.gitignore`:
```
node_modules/
dist/
.env
*.env.local
.DS_Store
```
Create `README.md` from `03_README.md`.

### Step 2 — Backend package files
In `backend/`: `package.json`, `tsconfig.json`, `jest.config.ts`, `nodemon.json`, `.env.example`

### Step 3 — Backend source files (in this exact order)
1. `src/types/index.ts`
2. `src/lib/env.ts`
3. `src/lib/openai.ts`
4. `src/lib/cosine.ts`
5. `src/lib/retry.ts`
6. `src/lib/response.ts`             ← ok() and sendError() helpers
7. `src/lib/validate.ts`             ← Zod validation middleware
8. `src/schemas/index.ts`            ← all Zod request schemas + inferred types
9. `src/services/sanitizer.ts`
10. `src/services/vectorStore.ts`
11. `src/services/cacheService.ts`
12. `src/services/searchService.ts`
13. `src/middleware/errorHandler.ts`
14. `src/routes/publications.ts`
15. `src/routes/meta.ts`
16. `src/routes/search.ts`
17. `src/routes/refresh.ts`
18. `src/app.ts`

### Step 4 — Seed data
Save the provided JSON to `backend/src/data/publications.raw.json`.

### Step 5 — Backend tests
1. `tests/cosine.test.ts`
2. `tests/cacheService.test.ts`
3. `tests/sanitizer.test.ts`

### Step 6 — Frontend package files
```bash
npm create vite@latest frontend -- --template react-ts
npm install tailwindcss @tailwindcss/vite @tanstack/react-query
```
Update: `vite.config.ts`, `tailwind.config.ts`, `src/index.css`, `index.html`, `.env.example`

### Step 7 — Frontend source files (in this exact order)
1. `src/constants/index.ts`              ← ALL magic values, style maps, labels
2. `src/schemas/index.ts`                ← all Zod schemas (request + response) + inferred types
3. `src/types/index.ts`                  ← re-exports from schemas only
4. `src/lib/api.ts`                      ← apiGet, apiPost, ApiError — three-gate validation
5. `src/hooks/useServerReady.ts`         ← single hook, polls /health, returns ready/stage
6. `src/hooks/useFetchMeta.ts`           ← raw useQuery for /api/publications/meta
8. `src/hooks/useFetchPublications.ts`   ← raw useQuery, server-side filtering via queryKey
9. `src/hooks/usePublications.ts`        ← page/filter state, calls useFetchPublications
10. `src/hooks/useSearchMutation.ts`     ← raw useMutation for /api/search
11. `src/hooks/useDebounce.ts`           ← generic debounce hook
12. `src/hooks/useSearch.ts`             ← debounced search, calls useSearchMutation
13. `src/components/ui/Button.tsx`       ← forwardRef, variant + size props
14. `src/components/ui/IconButton.tsx`   ← forwardRef, requires aria-label
15. `src/components/ui/Input.tsx`        ← forwardRef, leftSlot + rightSlot
16. `src/components/ui/Badge.tsx`        ← colour via className, domain-unaware
17. `src/components/ui/index.ts`         ← barrel export for all primitives
18. `src/components/InitialisingScreen.tsx`
19. `src/components/SkeletonCard.tsx`
20. `src/components/PublicationCard.tsx` ← uses Badge
21. `src/components/SearchBar.tsx`       ← uses Input, Button, IconButton
22. `src/components/RecycleBinToggle.tsx` ← uses Button
23. `src/components/StatusBanner.tsx`
24. `src/components/ProjectFilter.tsx`   ← uses Button, calls useFetchMeta internally
25. `src/components/Pagination.tsx`      ← uses Button, IconButton
26. `src/components/PublicationList.tsx`
27. `src/main.tsx`                       ← QueryClientProvider wrapper
28. `src/App.tsx`

Delete default `src/App.css` if it exists.

### Step 8 — Verify
```bash
cd backend && npm install && npx tsc --noEmit && npm test
cd ../frontend && npm install && npx tsc --noEmit
```
All must pass with zero errors.

---

## Engineering Principles

All code must follow these principles throughout. They are not suggestions — if a
pattern violates them, restructure until it doesn't.

### SOLID

**Single Responsibility** — Every file does one thing. A route handler validates
and delegates, nothing more. A service contains business logic, not HTTP concerns.
A hook owns either network state OR UI state, never both (see the fetch/UI hook split).
A component either fetches data OR renders it — not both, unless it is a self-contained
leaf like `ProjectFilter` where the coupling is intentional and documented.

**Open/Closed** — Services like `VectorStore` and `CacheService` expose a stable
public interface. Internal implementation (in-memory array, TTL strategy, batch size)
can change without touching callers. No consumer should reach into a service's internals.

**Liskov Substitution** — Not directly applicable here, but the principle of
substitutability applies to the `withRetry` wrapper — it wraps any async function
without changing its return type or throwing different errors than the wrapped function
would.

**Interface Segregation** — Types are narrow and purpose-built. `RawPublication` and
`Publication` are separate types even though they overlap — callers of the sanitiser
deal with one, callers of the vector store deal with the other. `MetaResponse` is not
bolted onto `PaginatedResponse` — it is its own type fetched by its own endpoint.

**Dependency Inversion** — High-level orchestration (`searchService.ts`) depends on
abstractions (`vectorStore.embedText`, `cacheService.lookup`) not on OpenAI directly.
The OpenAI client is a singleton imported by low-level services only, never by routes
or the app entry point.

### DRY

- The `withRetry` wrapper exists precisely to avoid copy-pasting retry logic across
  every OpenAI call. Use it consistently — never inline retry logic anywhere.
- `apiGet` and `apiPost` are the only fetch functions in the frontend. No raw `fetch()`
  calls anywhere else. Error parsing, base URL resolution, and header defaults live in
  exactly one place.
- `ApiError` is defined once and used everywhere — in `main.tsx` retry config, in
  component error handling, in query callbacks. Never construct a new error class for
  the same concept.
- The 503 "service initialising" response is the same object shape across all routes —
  if it ever changes, it changes in one place. Consider extracting it to a shared
  middleware helper if it appears more than twice.

### Backend best practices

**Routes are thin** — Route handlers do three things only: validate input, call a
service, return the response. No business logic, no direct OpenAI calls, no array
manipulation inside a route file.

**Services own their domain** — `sanitizer.ts` owns data cleaning. `vectorStore.ts`
owns embeddings and vector search. `cacheService.ts` owns cache logic. `searchService.ts`
orchestrates them. None of these reach into each other's internal state.

**Fail fast and loudly** — `validateEnv()` runs before anything else. The bootstrap
function logs each stage with timing. Fatal errors call `process.exit(1)` with a clear
message. A server that starts silently broken is worse than one that refuses to start.

**Singletons are explicit** — `vectorStore`, `cacheService`, and `openai` are module-level
singletons exported from their files. This is intentional and documented. Do not
instantiate these classes anywhere else.

**No business logic in `app.ts`** — `app.ts` wires things together: middleware,
routes, bootstrap sequence. It contains no sanitisation, no search logic, no data
manipulation.

**Error handler is the last middleware** — `errorHandler` must be registered after all
routes. Any route that catches an async error must call `next(err)`, not `res.status(500)`,
so the centralised handler processes it.

### Frontend best practices

**Hooks follow the two-layer pattern consistently** — Every data concern has a raw
fetch hook (`useFetchX`) and optionally a UI state hook (`useX`) that consumes it.
Never put `useState` for UI concerns inside a fetch hook. Never put `useQuery` inside
a UI-state-only hook.

**Components are presentational by default** — Components receive props and render.
The exception is self-contained leaf components like `ProjectFilter` where internal
data fetching is explicitly intentional and documented. This exception should be rare.

**Query keys are the source of truth for cache invalidation** — Always use structured
query keys: `['publications', { page, project, category }]` not `['publications-page-1']`.
This makes invalidation patterns predictable — `invalidateQueries(['publications'])`
invalidates all publication queries regardless of params.

**No prop drilling past one level** — If a value needs to travel more than one
component deep, it belongs in a hook. The filter state lives in `usePublications`,
not threaded through App → Sidebar → ProjectFilter as props.

**TypeScript is strict — treat it as documentation** — Every function has explicit
return types. Every API response has a corresponding interface in `types/index.ts`.
`unknown` is preferable to `any` where a type cannot be known. `as Type` casts are
a last resort and must have a comment explaining why.

---

## Critical Rules

1. **Never hardcode an API key.** All keys from `.env` only.

2. **`validateEnv()` must be the very first thing called in `app.ts`**, before any
   other imports that might use environment variables.

3. **Server listens BEFORE the AI pipeline runs.** Start `app.listen()` at the top of
   `bootstrap()` so `/health` is reachable during the ~20s startup window.

4. **Query is embedded exactly ONCE per search request.**
   In `searchService.ts`:
   ```typescript
   const queryVector = await vectorStore.embedText(query);
   const cached = cacheService.lookup(queryVector);
   // ...
   const results = vectorStore.searchByVector(queryVector, 10, includeDeleted);
   ```

5. **Sanitiser makes exactly TWO OpenAI calls** — Pass 1 clusters unique values,
   Pass 2 cleans all docs. No hardcoded canonical lists anywhere.

6. **`withRetry` wraps all OpenAI embedding batch calls** in vectorStore and both
   sanitiser passes.

7. **Deleted docs are excluded from search by default** (`includeDeleted = false`).
   They appear in the publications list (AC requires 150 total) but are filtered
   out of `searchByVector` unless `includeDeleted = true`.

8. **Recycle bin searches are NOT cached** — only standard searches are cached.
   See `searchService.ts`.

9. **Cache has a 1-hour TTL.** Check timestamp on lookup, skip expired entries.
   Call `cacheService.clear()` in `POST /api/refresh`.

10. **`POST /api/refresh` requires `x-admin-key` header** matching `process.env.ADMIN_KEY`.

11. **Publications endpoint returns 400** (not empty array) when `page` exceeds
    `totalPages`.

12. **Frontend shows `<InitialisingScreen>`** (not an error) while polling `/health`
    returns `ready: false`. Only render the main UI once `ready: true`.

13. **`resolveJsonModule: true`** in tsconfig so raw JSON import works.

14. **TypeScript strict mode** — no `any`, no `@ts-ignore`.

15. **Every API response goes through `ok()` or `sendError()`** — no route ever
    constructs `{ success: true, data: ... }` manually. Import from `lib/response.ts`.

16. **Every route that accepts a body uses `validate(schema)` middleware** — the route
    function receives a typed, parsed body. No manual `req.body.x` checks in routes.

17. **No manual interface or type definitions anywhere except `schemas/index.ts`**.
    Backend `src/schemas/index.ts` contains ALL schemas — raw data, domain types,
    request bodies. Frontend `src/schemas/index.ts` contains ALL response schemas.
    If a type is needed, create a Zod schema and infer the type with `z.infer<>`.

18. **`useQuery` and `useMutation` return `ApiResult<T>`** — hooks access payload
    as `data?.data` and pagination as `data?.pagination`. No `success` checks anywhere
    outside `api.ts`. Example:
    ```typescript
    const { data } = useQuery({ queryFn: () => apiGet('/api/publications/meta', undefined, metaDataSchema) });
    const projects = data?.data?.projects ?? []; // data is ApiResult<MetaData>
    ```

    **`useQuery` and `useMutation` types**:
    ```typescript
    type MyResponse = z.infer<typeof mySchema>;
    useQuery<MyResponse, Error>({ ... })
    useMutation<MyResponse, Error, MyRequest>({ ... })
    ```
    Never use `useQuery<ManualInterface>` — the type must come from the schema.

19. **`types/index.ts` on both frontend and backend are pure re-export files** —
    they re-export from `schemas/index.ts` only. Nothing is defined in them directly.
    Components receive unwrapped payload types as props, never full envelope types.

22. **All interactive elements use the UI primitives** — no raw `<button>` or `<input>`
    anywhere outside `src/components/ui/`. Every button in the app goes through
    `Button` or `IconButton`. Every text input goes through `Input`. Every label/tag
    goes through `Badge`. This is enforced — not a guideline.

23. **`forwardRef` on all UI primitives** — `Button`, `IconButton`, and `Input` use
    `React.forwardRef` so they work with third-party libraries that inject refs.
    Each must have `displayName` set for React DevTools.

24. **`IconButton` requires `aria-label`** — it is typed as a required prop, not
    optional. An icon-only button with no label is an accessibility failure.

25. **`Badge` is domain-unaware** — it accepts `className` for colour, never a
    `variant` prop tied to category names or status values. Colour mapping stays
    in `constants/index.ts`. This keeps the primitive reusable outside this domain.

26. **All magic values come from `src/constants/index.ts`** — no inline numbers,
    strings, or style maps anywhere else. This includes debounce delays, page sizes,
    poll intervals, stale times, and all Tailwind class maps for categories/statuses.

23. **Search fires automatically via debounce** — `useSearch` uses `useDebounce` and
    a `useEffect` to call `mutate` when the debounced query changes. App.tsx does not
    have a `handleSearch` callback. `SearchBar`'s `onSearch` prop simply calls `setQuery`
    (Enter key / button press sets the query immediately, debounce fires the request).

24. **`useDebounce` is generic** — `useDebounce<T>(value: T, delayMs: number): T`.
    It can debounce any value, not just strings. Use `SEARCH_DEBOUNCE_MS` from constants.

25. **`parseRawPublications()` in `sanitizer.ts`** must be called in both `app.ts`
    and `refresh.ts` instead of `rawData as unknown as RawPublication[]`. Zod validates
    the seed data at the boundary — never cast JSON imports with `as`.

21. **`parseResponse` in `api.ts` enforces three gates in order**: `res.ok` →
    `json.success` → `schema.parse`. Each failure throws a distinct error type.
    ZodErrors from gate 3 surface as schema validation failures, not API errors.

20. **Filtering and pagination are server-side** — `useFetchPublications` passes
    `page`, `project`, and `category` as query params. The backend handles filtering.
    Do NOT filter or slice arrays client-side in any hook or component.

16. **`ProjectFilter` fetches its own data** via `useFetchMeta` — it receives no
    `projects` or `categories` props from App.tsx. The concern is fully encapsulated.

17. **`placeholderData: (prev) => prev`** in `useFetchPublications` keeps the previous
    page visible while the next loads — prevents skeleton flash on filter/page change.

18. **`GET /api/publications/meta`** must be registered in `app.ts` BEFORE
    `/api/publications` to avoid Express treating "meta" as a dynamic `:id` param.

19. **`QueryClientProvider` wraps the app in `main.tsx`** — not in `App.tsx`.
    `defaultOptions` must configure retry to skip 4xx errors (use `instanceof ApiError`).

16. **`apiGet` and `apiPost` are the only fetch functions** — no raw `fetch()` calls
    anywhere else in the frontend. All requests go through these two functions.

17. **`useQuery` always forwards the `signal`** from the queryFn context parameter
    to `apiGet`/`apiPost` for automatic request cancellation on unmount.

---

## Acceptance Criteria Checklist

- [ ] `GET /api/publications?limit=200` returns exactly 150 items
- [ ] No title contains `DRAFT`, `v1`, `FINAL`, `COPY`, or `OLD_`
- [ ] `POST /api/search` with `{ "query": "success story" }` returns semantic matches
- [ ] Same search twice → second response has `"cacheHit": true`
- [ ] `POST /api/search` with `{ "query": "...", "includeDeleted": true }` returns
      deleted publication results
- [ ] Frontend shows `InitialisingScreen` with stage labels during cold start
- [ ] "Search in recycle bin" toggle appears during search mode
- [ ] Project/category filter changes are instant (no spinner after first load)
- [ ] `GET /api/publications?page=999` returns 400 with error message
- [ ] All 3 Jest test suites pass: `cd backend && npm test`
- [ ] `npx tsc --noEmit` passes in both `backend/` and `frontend/`
