# Foleon Content Hub

A fullstack "Smart Hub" proof of concept — an embeddable content discovery experience
powered by semantic search, LLM-based data healing, and a vector similarity cache.

## Features

- **AI Data Healing** — GPT-4o-mini cleans messy legacy titles (`DRAFT_`, `v1_FINAL`,
  `COPY`, `OLD_`), normalises inconsistent category casing, and maps 20+ messy project
  name variants to 10 canonical names — all in a single batched API call
- **Semantic Search** — `text-embedding-3-small` embeddings + cosine similarity means
  searching "help documentation" surfaces "Developer Manual" and "API Docs"
- **Semantic Cache** — Queries with ≥ 95% vector similarity return instantly from cache
  (typically < 50ms) rather than re-running the embedding pipeline
- **150 Publications** — Fully paginated grid with client-side project and category
  filtering (instant, no extra network calls after initial load)
- **Cache Transparency** — UI shows ⚡ (cached) or 🔍 (fresh AI search) with response
  time in ms after every search
- **Relevance Score Bars** — Search result cards display cosine similarity percentage

## Architecture

```
┌────────────────────────────────────────┐
│           React Frontend               │
│  SearchBar · Filters · Grid · Pager    │
└──────────────┬─────────────────────────┘
               │ REST over HTTP
┌──────────────▼─────────────────────────┐
│         Express Backend                │
│                                        │
│  GET  /api/publications                │
│  POST /api/search                      │
│  GET  /health                          │
│                                        │
│  Startup pipeline (runs once):         │
│  1. Load 150 raw publications          │
│  2. SanitizerService (GPT-4o-mini)     │
│     └── 1 batched API call             │
│  3. VectorStore (text-embedding-3-sm.) │
│     └── 8 batched embedding calls      │
│  4. Server ready                       │
│                                        │
│  Search pipeline (per request):        │
│  1. Embed query once                   │
│  2. CacheService.lookup (cosine ≥0.95) │
│     hit  → return instantly            │
│     miss → VectorStore.searchByVector  │
│          → CacheService.store          │
└────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI API key

### 1. Clone the repo

```bash
git clone <repo-url>
cd foleon-content-hub
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm install
npm run dev
```

Server starts on `http://localhost:3001`.

**Startup takes ~15–30 seconds** — the server calls OpenAI to heal the data and build
the embedding index. The `/health` endpoint returns `{ ready: false }` during this
window. Once ready, all API endpoints are available.

**Estimated API cost on startup**: < $0.005 (one GPT-4o-mini call + ~8 embedding calls).

### 3. Frontend

```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

App runs on `http://localhost:5173`.

## API Reference

### `GET /api/publications`

Returns the paginated, healed publication list.

| Query param | Type   | Default | Description                      |
| ----------- | ------ | ------- | -------------------------------- |
| `page`      | number | 1       | Page number (1-indexed)          |
| `limit`     | number | 20      | Results per page (max 200)       |
| `project`   | string | —       | Filter by canonical project name |
| `category`  | string | —       | Filter by canonical category     |

**Response**

```json
{
    "data": [
        {
            "id": "fol_001",
            "title": "Client Testimonial Alpha",
            "project": "Marketing",
            "category": "Success Stories",
            "created_at": "2024-01-15T09:30:00Z",
            "status": "draft"
        }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
}
```

### `POST /api/search`

Semantic search over all publication titles and categories.

**Request body**

```json
{ "query": "developer guide for authentication" }
```

**Response**

```json
{
  "results": [
    {
      "publication": { "id": "fol_005", "title": "Developer Manual - Authentication", ... },
      "score": 0.94
    }
  ],
  "cacheHit": false,
  "latencyMs": 812
}
```

On a repeated or semantically similar query (cosine similarity ≥ 0.95), the response
returns instantly with `cacheHit: true`.

### `GET /health`

Returns server readiness. Available immediately on startup, before the AI pipeline
completes.

```json
{ "status": "ok", "ready": true }
```

## Running Tests

```bash
cd backend
npm test
```

Three test suites:

- **cosine.test.ts** — Cosine similarity math, edge cases, high-dimensional vectors
- **cacheService.test.ts** — Cache miss, cache hit, similarity threshold, size tracking
- **sanitizer.test.ts** — Null/empty title pre-processing, LLM response parsing, single
  API call verification (OpenAI mocked)

## Design Decisions

**Why show all 150 documents including deleted/archived?**
The acceptance criteria explicitly requires "all 150 documents". Status is surfaced as
a visual badge per card rather than a filter that hides records. This also better
demonstrates the data-healing aspect — even stale records receive clean titles.

**Why embed `title + category` instead of just the title?**
A query like "success story" should match documents with category "Success Stories"
even when the title is just "Case Study: ACME". Concatenating both fields into the
embedding string improves semantic recall at zero extra cost.

**Why a single LLM call for sanitisation?**
Sending all 150 documents in one GPT-4o-mini call with `response_format: json_object`
costs ~$0.001 and takes ~3 seconds. One-call-per-document would cost 150× more
and take far longer.

**Why 0.95 as the cache similarity threshold?**
High enough to catch near-identical queries ("help", "Help", "HELP!") while not
conflating semantically distinct queries ("sales report" vs "technical guide").

**Why in-memory vectors instead of a vector database?**
At 150 documents, a full cosine scan completes in under 1ms. A vector DB like Chroma
or pgvector adds operational complexity with no performance benefit at this scale.
The `VectorStore` class is self-contained and could be swapped for a persistent store
by changing a single service file.

## Demo Walkthrough

Follow these steps in order to see every feature working end-to-end.

### Step 1 — Start the backend

```bash
cd backend && npm run dev
```

Watch the console for:

- Discovered project name mappings (e.g. `MARKETING_2024` → `Marketing`)
- Embedding progress (`20/150 embedded`, `40/150 embedded`, …)
- `Server ready` confirmation

### Step 2 — Start the frontend

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Step 3 — Watch the InitialisingScreen

The app polls `/health` while the AI pipeline runs. You will see the startup stage
progress through labels (Healing data → Building index → Ready) before the main grid
appears.

### Step 4 — Semantic search: "success story"

Type `success story` in the search bar. Observe that results include **Case Study**
publications even though you didn't search for "case study" — the embedding captures
semantic intent, not just keywords.

### Step 5 — Cache hit: search "success story" again

Run the same search a second time. The banner switches to **⚡ Instant result** and
latency drops to under 50ms — the semantic cache returned results without calling
OpenAI again.

### Step 6 — Search "help"

Clear and type `help`. Results surface **Developer Manual** and **FAQ** publications
despite neither containing the word "help" — semantic similarity at work.

### Step 7 — Recycle bin toggle

Enable **Search in recycle bin** (toggle below the search bar) and search again.
Deleted publications appear in results with a red border and reduced opacity.

### Step 8 — Browse mode: project and category filters

Clear the search to return to browse mode. Use the sidebar filters to select a project
(e.g. **Marketing**) and a category (e.g. **Success Stories**). Filtering is instant —
no network request is made because the full dataset was loaded on initial page load.

### Step 9 — Pagination

With filters cleared, navigate through the publication grid using the page controls at
the bottom. Each page shows 20 publications.

### Step 10 — Run the test suite

```bash
cd backend && npm test
```

77 tests across 10 suites should all pass. The suite covers cosine similarity math,
cache behaviour, the LLM sanitiser (OpenAI mocked), vector store build and search,
middleware, response helpers, and all three API routes via supertest.
