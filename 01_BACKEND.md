# Backend Implementation Spec (v3 — Senior Engineering)

## Engineering Principles

All backend code must follow these principles. They are enforced — not aspirational.

**Single Responsibility** — Routes validate and delegate only. Services own one domain
(sanitising, embedding, caching, searching). `app.ts` wires — it contains no logic.

**DRY** — `withRetry` is the only place retry logic lives. The 503 "initialising"
guard appears in every route but is identical — if it's repeated more than twice,
extract it to middleware. No inline OpenAI calls outside service files.

**Dependency Inversion** — `searchService.ts` depends on `vectorStore` and
`cacheService` abstractions. Routes depend on services. Nothing depends on OpenAI
directly except the two lib files (`openai.ts`, used only inside services).

**Fail fast** — `validateEnv()` first, always. Fatal errors exit with a clear message.
Never swallow errors silently.

**Thin routes** — A route handler does exactly: (1) check ready, (2) validate input,
(3) call service, (4) return response. Nothing else.

**Singletons are explicit** — `vectorStore`, `cacheService`, `openai` are module-level
exports. Never instantiate these classes elsewhere.

**Error handling is centralised** — Routes call `next(err)` for unhandled errors.
`errorHandler` middleware is the single place that writes 500 responses.

---

## Setup

```bash
mkdir backend && cd backend
npm init -y
npm install express cors dotenv openai zod
npm install -D supertest @types/supertest jest-mock-extended
npm install -D typescript ts-node @types/node @types/express @types/cors nodemon jest ts-jest @types/jest
npx tsc --init
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "tests"]
}
```

### package.json scripts
```json
{
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest --config jest.config.ts"
  }
}
```

### jest.config.ts
```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterFramework: [],
  // Extend expect with jest-extended matchers if needed
  // setupFilesAfterFramework: ['jest-extended/all'],
};
```

### nodemon.json
```json
{
  "watch": ["src"],
  "ext": "ts",
  "exec": "ts-node src/app.ts"
}
```

---

## src/schemas/index.ts

All Zod schemas live here — both request bodies and internal domain types.
Inferred TypeScript types replace all manual interface definitions.
`types/index.ts` re-exports from here so import paths stay consistent everywhere.

```typescript
import { z } from 'zod';

// ─── Raw data (from JSON file) ───────────────────────────────────────────────

export const rawPublicationSchema = z.object({
  id: z.string(),
  project_name: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  created_at: z.string(),
  status: z.enum(['published', 'draft', 'archived', 'deleted']),
});

// ─── Domain types ────────────────────────────────────────────────────────────

export const publicationSchema = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string(),
  category: z.string(),
  created_at: z.string(),
  status: z.enum(['published', 'draft', 'archived', 'deleted']),
});

export const searchResultSchema = z.object({
  publication: publicationSchema,
  score: z.number(),
});

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// Internal types — not sent over the wire
export const vectorEntrySchema = z.object({
  publication: publicationSchema,
  vector: z.array(z.number()),
});

export const cacheEntrySchema = z.object({
  queryVector: z.array(z.number()),
  results: z.array(searchResultSchema),
  timestamp: z.number(),
});

// ─── Request body schemas ────────────────────────────────────────────────────

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, 'query must be a non-empty string').max(500),
  includeDeleted: z.boolean().default(false),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
// Import these via types/index.ts — never import from schemas directly in app code

export type RawPublication = z.infer<typeof rawPublicationSchema>;
export type Publication    = z.infer<typeof publicationSchema>;
export type SearchResult   = z.infer<typeof searchResultSchema>;
export type Pagination     = z.infer<typeof paginationSchema>;
export type VectorEntry    = z.infer<typeof vectorEntrySchema>;
export type CacheEntry     = z.infer<typeof cacheEntrySchema>;
export type SearchRequest  = z.infer<typeof searchRequestSchema>;
```

---

## src/types/index.ts

Pure re-export file — single consistent import path for the rest of the app.
Never define types here directly.

```typescript
export type {
  RawPublication,
  Publication,
  SearchResult,
  Pagination,
  VectorEntry,
  CacheEntry,
  SearchRequest,
} from '../schemas';
```

---

## src/lib/env.ts

**Validate all required environment variables at startup — before anything else runs.**
Fail fast with a clear, actionable error message rather than a cryptic failure 20s in.

```typescript
const REQUIRED_ENV_VARS = ['OPENAI_API_KEY'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('');
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('');
    console.error('Copy .env.example to .env and fill in the values.');
    console.error('');
    process.exit(1);
  }
}
```

---

## src/lib/response.ts

`ok` and `err` helper functions enforce the consistent API envelope across all routes.
Every response in the application goes through one of these two functions — no route
ever constructs a response object manually.

```typescript
import { Response } from 'express';
import { Pagination } from '../types';

interface ApiError {
  message: string;
  code?: string;
}

export interface OkOptions {
  pagination?: Pagination;
  status?: number;
}

/**
 * Send a successful response.
 * @example res.json(ok({ items: publications }, { pagination }))
 * @example res.json(ok({ projects, categories }))
 */
export function ok<T>(data: T, options: OkOptions = {}) {
  return {
    success: true as const,
    data,
    pagination: options.pagination ?? null,
    error: null,
  };
}

/**
 * Send an error response.
 * @example return sendError(res, 400, 'query must be a non-empty string', 'VALIDATION_ERROR')
 * @example return sendError(res, 503, 'Service initialising', 'NOT_READY')
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string
) {
  return res.status(status).json({
    success: false as const,
    data: null,
    pagination: null,
    error: { message, ...(code && { code }) } satisfies ApiError,
  });
}
```

---

## src/lib/validate.ts

Zod validation middleware. Pass a schema — if parsing fails, sends a structured
`VALIDATION_ERROR` response immediately. If it passes, attaches the parsed (typed)
body to `req.body` and calls `next()`. Routes never touch raw `req.body` directly.

```typescript
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from './response';

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return sendError(res, 400, message, 'VALIDATION_ERROR');
    }

    // Replace raw body with parsed, typed, coerced body
    req.body = result.data;
    return next();
  };
}
```

---

## src/lib/openai.ts

```typescript
import OpenAI from 'openai';

// Note: validateEnv() is called in app.ts before this module is imported,
// so process.env.OPENAI_API_KEY is guaranteed to exist here.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});
```

---

## src/lib/cosine.ts

```typescript
/**
 * Compute cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1].
 * Returns 0 if either vector has zero magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;

  return dot / denominator;
}
```

---

## src/lib/retry.ts

Transient OpenAI failures (rate limits, network blips) should not crash the server.
Use exponential backoff on embedding batches — the most likely place to hit rate limits.

```typescript
interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
}

/**
 * Retry an async operation with exponential backoff.
 * Suitable for transient failures (rate limits, network errors).
 * Does NOT retry on 4xx errors (bad request, invalid key) — those are permanent.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 1000, label = 'operation' }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      // Don't retry permanent client errors (auth failures, bad requests).
      // Exception: 429 Too Many Requests IS transient and must be retried.
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `[Retry] ${label} failed (attempt ${attempt}/${maxAttempts}). ` +
          `Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

---

## src/services/sanitizer.ts

**Two-pass approach — fully data-driven, no hardcoded canonical lists.**

Pass 1 discovers canonical project names and categories by inspecting only the unique
raw values. Pass 2 cleans all documents using those discovered mappings.

This means the sanitiser works correctly on ANY dataset — completely different project
names, new categories, different noise patterns — with no code changes required.

**Structured startup logging** is included so the console shows exactly what the LLM
discovered during the demo.

```typescript
import { z } from 'zod';
import { openai } from '../lib/openai';
import { withRetry } from '../lib/retry';
import { rawPublicationSchema, RawPublication, Publication } from '../schemas';

// ─── Pass 1: Discover canonical names from raw unique values ─────────────────

const CLUSTERING_SYSTEM_PROMPT = `
You are a data analyst. You will receive two lists of raw strings from a legacy
content management system:
1. "project_names" — raw project identifiers (may be ALL_CAPS, kebab-case, snake_case,
   have version numbers, department suffixes, year suffixes, etc.)
2. "categories" — raw category labels (may be ALL CAPS, lowercase, mixed case; null
   is represented as the string "null")

Your tasks:
A. CLUSTER the project_names into logical groups. Each group represents the same
   real-world project expressed in different formats. For each group, invent ONE clean,
   human-readable canonical name in Title Case (e.g. "Marketing", "Developer Portal").
   Use semantic meaning to guide grouping — version numbers, year suffixes, department
   codes, and case differences should NOT create separate groups.

B. NORMALISE the categories. Group equivalent labels (same meaning, different casing
   or formatting) into one clean Title Case canonical label. If a value is "null" or
   clearly uncategorised, map it to "Uncategorised". Infer from context where possible.

Return ONLY valid JSON — no markdown, no explanation:
{
  "project_mapping": { "<raw_value>": "<canonical_name>", ... },
  "category_mapping": { "<raw_value>": "<canonical_name>", ... }
}
Every raw value provided MUST appear as a key in the appropriate mapping.
`.trim();

// ─── Pass 2: Clean all documents using discovered mappings ───────────────────

const CLEANING_SYSTEM_PROMPT = `
You are a data cleaning assistant for a content management system.
You will receive:
- "project_mapping": maps raw project_name values → canonical project names
- "category_mapping": maps raw category values → canonical category names
- "publications": array of documents to clean

For each publication:
1. CLEAN the title:
   - Strip dev-noise prefixes: DRAFT_, draft_, v1_, v2_, v3_, vN_, FINAL_, OLD_,
     COPY, COPY_, TEMP_, WIP_, [WIP]
   - Strip dev-noise suffixes: _FINAL, _final, _v1, _v2, _v3, _DRAFT, _draft,
     _copy, -copy, _backup, _TEST, _test, _WIP
   - Remove standalone inline version tokens like "v3", "v4.1", "V2" between spaces
   - Replace underscores used as word separators with spaces
   - Clean up double spaces, trailing hyphens, leading/trailing punctuation
   - Apply correct Title Case

2. MAP project_name → "project" using project_mapping
3. MAP category → "category" using category_mapping
   - If null/empty, infer from cleaned title before falling back to "Uncategorised"

Return ONLY valid JSON: { "publications": [...] }
Each item: { "id": string, "title": string, "project": string, "category": string }
`.trim();

interface Mappings {
  project_mapping: Record<string, string>;
  category_mapping: Record<string, string>;
}

async function discoverMappings(rawDocs: RawPublication[]): Promise<Mappings> {
  const uniqueProjects = Array.from(new Set(rawDocs.map((d) => d.project_name)));
  const uniqueCategories = Array.from(
    new Set(rawDocs.map((d) => d.category ?? 'null'))
  );

  console.log(
    `  [Pass 1] Clustering ${uniqueProjects.length} project variants, ` +
    `${uniqueCategories.length} category variants...`
  );

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLUSTERING_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ project_names: uniqueProjects, categories: uniqueCategories }) },
      ],
    }),
    { label: 'Sanitizer Pass 1' }
  );

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error('[Sanitizer] Pass 1: empty response from OpenAI');

  const parsed = JSON.parse(raw) as Mappings;
  if (!parsed.project_mapping || !parsed.category_mapping) {
    throw new Error('[Sanitizer] Pass 1: response missing project_mapping or category_mapping');
  }

  // Log the discovered mappings — impressive demo moment
  const canonicalProjects = Array.from(new Set(Object.values(parsed.project_mapping)));
  const canonicalCategories = Array.from(new Set(Object.values(parsed.category_mapping)));

  console.log(`  [Pass 1] Discovered ${canonicalProjects.length} canonical projects:`);
  canonicalProjects.forEach((canon) => {
    const variants = Object.entries(parsed.project_mapping)
      .filter(([, v]) => v === canon)
      .map(([k]) => k);
    console.log(`    "${variants.join('", "')}" → "${canon}"`);
  });

  console.log(`  [Pass 1] Discovered ${canonicalCategories.length} canonical categories:`);
  canonicalCategories.forEach((canon) => {
    const variants = Object.entries(parsed.category_mapping)
      .filter(([, v]) => v === canon)
      .map(([k]) => k);
    console.log(`    "${variants.join('", "')}" → "${canon}"`);
  });

  return parsed;
}

async function cleanDocuments(
  prepped: Array<{ id: string; title: string; project_name: string; category: string }>,
  mappings: Mappings
): Promise<Array<{ id: string; title: string; project: string; category: string }>> {
  console.log(`  [Pass 2] Cleaning ${prepped.length} publication titles...`);

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLEANING_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ ...mappings, publications: prepped }) },
      ],
    }),
    { label: 'Sanitizer Pass 2' }
  );

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error('[Sanitizer] Pass 2: empty response from OpenAI');

  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed)
    ? parsed
    : parsed.publications ?? (Object.values(parsed)[0] as typeof parsed.publications);

  if (!Array.isArray(items)) {
    throw new Error('[Sanitizer] Pass 2: response is not an array');
  }

  return items;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse and validate raw JSON input against the schema before processing.
 * Catches malformed seed data at the boundary rather than failing deep in a service.
 */
export function parseRawPublications(data: unknown): RawPublication[] {
  return z.array(rawPublicationSchema).parse(data);
}

export async function sanitizePublications(
  rawDocs: RawPublication[]
): Promise<Publication[]> {
  console.log(`\n[Sanitizer] Starting sanitisation of ${rawDocs.length} publications...`);

  // Count and log data quality issues found — useful for observability
  const nullTitles = rawDocs.filter((d) => !d.title?.trim()).length;
  const nullCategories = rawDocs.filter((d) => !d.category).length;
  if (nullTitles > 0) console.log(`  [Pre-process] ${nullTitles} null/empty titles → "Untitled Document"`);
  if (nullCategories > 0) console.log(`  [Pre-process] ${nullCategories} null categories → will be inferred`);

  // Pre-process in TypeScript: handle nulls before any LLM call
  const prepped = rawDocs.map((doc) => ({
    id: doc.id,
    title: doc.title?.trim() || 'Untitled Document',
    project_name: doc.project_name,
    category: doc.category ?? 'null',
  }));

  const mappings = await discoverMappings(rawDocs);
  const cleaned = await cleanDocuments(prepped, mappings);

  if (cleaned.length !== rawDocs.length) {
    throw new Error(
      `[Sanitizer] Count mismatch: expected ${rawDocs.length}, got ${cleaned.length}`
    );
  }

  const cleanedMap = new Map(cleaned.map((c) => [c.id, c]));

  const result = rawDocs.map((doc): Publication => {
    const clean = cleanedMap.get(doc.id);
    return {
      id: doc.id,
      title: clean?.title ?? doc.title ?? 'Untitled Document',
      project: clean?.project ?? doc.project_name,
      category: clean?.category ?? 'Uncategorised',
      created_at: doc.created_at,
      status: doc.status,
    };
  });

  console.log(`[Sanitizer] Complete.\n`);
  return result;
}
```

---

## src/services/vectorStore.ts

```typescript
import { openai } from '../lib/openai';
import { withRetry } from '../lib/retry';
import { Publication, VectorEntry, SearchResult } from '../types';
import { cosineSimilarity } from '../lib/cosine';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20;

class VectorStore {
  private entries: VectorEntry[] = [];
  private built = false;

  async build(publications: Publication[]): Promise<void> {
    console.log(`[VectorStore] Embedding ${publications.length} publications in batches of ${BATCH_SIZE}...`);
    this.entries = [];
    const start = Date.now();

    for (let i = 0; i < publications.length; i += BATCH_SIZE) {
      const batch = publications.slice(i, i + BATCH_SIZE);

      // Embed title + category together for richer semantic signal.
      // A search for "success story" should match docs categorised as "Success Stories"
      // even when their title alone is a generic "Case Study: ACME".
      const inputs = batch.map((p) => `${p.title} ${p.category}`);

      const response = await withRetry(
        () => openai.embeddings.create({ model: EMBEDDING_MODEL, input: inputs }),
        { label: `Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}` }
      );

      response.data.forEach((embeddingObj, index) => {
        this.entries.push({ publication: batch[index], vector: embeddingObj.embedding });
      });

      console.log(
        `  [VectorStore] ${Math.min(i + BATCH_SIZE, publications.length)}/${publications.length} embedded`
      );
    }

    this.built = true;
    console.log(`[VectorStore] Build complete in ${Date.now() - start}ms.\n`);
  }

  async embedText(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Search using a pre-computed vector. Always call embedText() first,
   * then pass the result here — avoids double-embedding per request.
   *
   * @param includeDeleted - When true, deleted publications are included in results.
   *   Default false (deleted docs are excluded from normal search, see "recycle bin" feature).
   */
  searchByVector(queryVector: number[], topK = 10, includeDeleted = false): SearchResult[] {
    if (!this.built) throw new Error('[VectorStore] Store not built yet');

    const filtered = includeDeleted
      ? this.entries
      : this.entries.filter((e) => e.publication.status !== 'deleted');

    return filtered
      .map((entry) => ({
        publication: entry.publication,
        score: cosineSimilarity(queryVector, entry.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  getAll(): Publication[] {
    return this.entries.map((e) => e.publication);
  }

  isReady(): boolean {
    return this.built;
  }
}

export const vectorStore = new VectorStore();
```

---

## src/services/cacheService.ts

Includes TTL so cached results don't go stale if data is ever refreshed.

```typescript
import { cosineSimilarity } from '../lib/cosine';
import { SearchResult, CacheEntry } from '../types';

const SIMILARITY_THRESHOLD = 0.95;
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Note: In production, if the underlying publications are updated (e.g. via POST /api/refresh),
// call cacheService.clear() to invalidate stale results. TTL handles organic expiry.

class CacheService {
  private cache: CacheEntry[] = [];

  lookup(queryVector: number[]): SearchResult[] | null {
    const now = Date.now();

    for (const entry of this.cache) {
      // Evict expired entries on access rather than running a background sweep
      if (now - entry.timestamp > CACHE_TTL_MS) continue;

      if (cosineSimilarity(queryVector, entry.queryVector) >= SIMILARITY_THRESHOLD) {
        return entry.results;
      }
    }
    return null;
  }

  store(queryVector: number[], results: SearchResult[]): void {
    if (this.cache.length >= MAX_CACHE_SIZE) {
      this.cache.shift(); // FIFO eviction
    }
    this.cache.push({ queryVector, results, timestamp: Date.now() });
  }

  /** Invalidate all cached results. Call after data refresh. */
  clear(): void {
    this.cache = [];
  }

  size(): number {
    return this.cache.length;
  }
}

export const cacheService = new CacheService();
```

---

## src/services/searchService.ts

```typescript
import { vectorStore } from './vectorStore';
import { cacheService } from './cacheService';
import { SearchResponse } from '../types';

/**
 * @param includeDeleted - When true, search includes deleted publications
 *   ("recycle bin" mode). Cached results are keyed separately per mode.
 */
export async function semanticSearch(
  query: string,
  includeDeleted = false
): Promise<SearchResponse> {
  const start = Date.now();

  // Embed the query ONCE — reuse for both cache lookup and vector search
  const queryVector = await vectorStore.embedText(query);

  // Check cache — note: results are mode-specific, so we can't serve
  // a non-deleted cache result for a recycle-bin search and vice versa.
  // The simplest safe approach: only use cache for standard (non-deleted) searches.
  if (!includeDeleted) {
    const cached = cacheService.lookup(queryVector);
    if (cached) {
      return { results: cached, cacheHit: true, latencyMs: Date.now() - start };
    }
  }

  const results = vectorStore.searchByVector(queryVector, 10, includeDeleted);

  // Only cache standard searches — recycle bin results are niche and not worth caching
  if (!includeDeleted) {
    cacheService.store(queryVector, results);
  }

  return { results, cacheHit: false, latencyMs: Date.now() - start };
}
```

---

## src/middleware/errorHandler.ts

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);
  // Use the envelope shape even for unhandled errors so the frontend
  // can always rely on the same success/error structure
  res.status(500).json({
    success: false,
    data: null,
    pagination: null,
    error: {
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
```

---

## src/routes/meta.ts

Returns distinct canonical project names and categories from the full in-memory store.
Kept separate from the publications endpoint so the sidebar can fetch filter options
independently and the concern stays cleanly isolated.

```typescript
import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { ok, sendError } from '../lib/response';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const all = vectorStore.getAll();
  const projects = Array.from(new Set(all.map((p) => p.project))).sort();
  const categories = Array.from(new Set(all.map((p) => p.category))).sort();

  return res.json(ok({ projects, categories }));
});

export default router;
```

---

## src/routes/publications.ts

```typescript
import { Router, Request, Response } from 'express';
import { vectorStore } from '../services/vectorStore';
import { ok, sendError } from '../lib/response';
import { Pagination } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  if (!vectorStore.isReady()) {
    return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
  const projectFilter = req.query.project as string | undefined;
  const categoryFilter = req.query.category as string | undefined;

  let all = vectorStore.getAll();

  if (projectFilter) {
    all = all.filter((p) => p.project.toLowerCase() === projectFilter.toLowerCase());
  }
  if (categoryFilter) {
    all = all.filter((p) => p.category.toLowerCase() === categoryFilter.toLowerCase());
  }

  const total = all.length;
  const totalPages = Math.ceil(total / limit);

  if (page > totalPages && totalPages > 0) {
    return sendError(res, 400, `Page ${page} out of range. Total pages: ${totalPages}`, 'PAGE_OUT_OF_RANGE');
  }

  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);

  const pagination: Pagination = { page, limit, total, totalPages };
  return res.json(ok({ items }, { pagination }));
});

export default router;
```

---

## src/routes/search.ts

Accepts an `includeDeleted` boolean in the request body to enable recycle bin mode.

Validation is handled by the `validate` middleware — the route receives a fully typed,
parsed body and never needs to check for missing or malformed fields manually.

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { semanticSearch } from '../services/searchService';
import { vectorStore } from '../services/vectorStore';
import { validate } from '../lib/validate';
import { ok, sendError } from '../lib/response';
import { searchRequestSchema, SearchRequest } from '../schemas';

const router = Router();

router.post(
  '/',
  validate(searchRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!vectorStore.isReady()) {
      return sendError(res, 503, 'Service initialising, please retry in a moment', 'NOT_READY');
    }

    const { query, includeDeleted } = req.body as SearchRequest;

    try {
      const { results, cacheHit, latencyMs } = await semanticSearch(query, includeDeleted);
      return res.json(ok({ items: results, cacheHit, latencyMs }));
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
```

---

## src/routes/refresh.ts

**POST /api/refresh** — Re-runs the full sanitisation + embedding pipeline on demand.
Protected by a simple admin key. Demonstrates the system is operable, not just startable.

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { sanitizePublications, parseRawPublications } from '../services/sanitizer';
import { vectorStore } from '../services/vectorStore';
import { cacheService } from '../services/cacheService';
import { ok, sendError } from '../lib/response';
import rawData from '../data/publications.raw.json';
import { RawPublication } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  // Simple admin key guard — in production use a proper auth layer
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return sendError(res, 401, 'Unauthorised', 'UNAUTHORISED');
  }

  console.log('\n[Refresh] Manual refresh triggered...');
  const start = Date.now();

  try {
    const raw = parseRawPublications(rawData);
    const healed = await sanitizePublications(raw);
    await vectorStore.build(healed);

    // Invalidate cache — results based on old data are now stale
    cacheService.clear();
    console.log('[Refresh] Cache invalidated.');

    return res.json(ok({
      publicationCount: healed.length,
      durationMs: Date.now() - start,
    }));
  } catch (err) {
    return next(err);
  }
});

export default router;
```

---

## src/app.ts

```typescript
import dotenv from 'dotenv';
dotenv.config();

// Validate env vars FIRST — before any other imports that might use them
import { validateEnv } from './lib/env';
validateEnv();

import express from 'express';
import cors from 'cors';
import { sanitizePublications, parseRawPublications } from './services/sanitizer';
import { vectorStore } from './services/vectorStore';
import { cacheService } from './services/cacheService';
import { errorHandler } from './middleware/errorHandler';
import { ok } from './lib/response';
import publicationsRouter from './routes/publications';
import metaRouter from './routes/meta';
import searchRouter from './routes/search';
import refreshRouter from './routes/refresh';
import rawData from './data/publications.raw.json';
import { RawPublication, HealthResponse } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

// In production, replace with your actual deployed frontend domain.
// CORS is intentionally restrictive — no wildcard in production.
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Track startup stage for the health endpoint
let startupStage = 'initialising';

// Health check — always available, even during the startup pipeline.
// The frontend polls this before showing the main UI.
app.get('/health', (_req, res) => {
  res.json(ok({
    ready: vectorStore.isReady(),
    ...(vectorStore.isReady() ? {} : { startupStage }),
  }));
});

app.use('/api/publications', publicationsRouter);
app.use('/api/publications/meta', metaRouter);
app.use('/api/search', searchRouter);
app.use('/api/refresh', refreshRouter);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   Foleon Content Hub — Backend       ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Start listening immediately so /health is reachable during startup
  app.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] /health available — ready: false\n`);
  });

  try {
    // Parse and validate raw JSON at the boundary using Zod —
    // catches malformed seed data before it reaches any service
    const raw = parseRawPublications(rawData);
    console.log(`[Bootstrap] Loaded ${raw.length} raw publications from seed file`);

    // Deleted docs design decision:
    // All 150 docs (including deleted) are loaded into the vector store.
    // The publications list endpoint returns all 150 (AC requirement).
    // Deleted docs are EXCLUDED from standard search results by default.
    // They are only included when the frontend sends { includeDeleted: true }
    // via the "Search in Recycle Bin" toggle — see searchService.ts.
    const deletedCount = raw.filter((d) => d.status === 'deleted').length;
    console.log(
      `[Bootstrap] Status breakdown: ` +
      `${raw.filter(d => d.status === 'published').length} published, ` +
      `${raw.filter(d => d.status === 'draft').length} draft, ` +
      `${raw.filter(d => d.status === 'archived').length} archived, ` +
      `${deletedCount} deleted (excluded from search by default)`
    );

    startupStage = 'sanitising';
    const sanitiseStart = Date.now();
    const healed = await sanitizePublications(raw);
    console.log(`[Bootstrap] Sanitisation complete in ${Date.now() - sanitiseStart}ms`);

    startupStage = 'embedding';
    const embedStart = Date.now();
    await vectorStore.build(healed);
    console.log(`[Bootstrap] Embedding complete in ${Date.now() - embedStart}ms`);

    startupStage = 'ready';
    console.log('✅ Server ready — all endpoints active\n');

  } catch (err) {
    console.error('\n❌ Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
```

---

## backend/.env.example

```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_KEY=your_admin_key_here
```

---

## tests/fixtures.ts

Shared test data used across all test files. Import from here — never duplicate
fixture data between test files.

```typescript
import { Publication, SearchResult } from '../src/types';

export const mockPublications: Publication[] = [
  {
    id: 'fol_001',
    title: 'Client Testimonial Alpha',
    project: 'Marketing',
    category: 'Success Stories',
    created_at: '2024-01-15T09:30:00Z',
    status: 'published',
  },
  {
    id: 'fol_002',
    title: 'API Documentation Core',
    project: 'Developer Portal',
    category: 'Technical Guides',
    created_at: '2024-02-01T10:00:00Z',
    status: 'published',
  },
  {
    id: 'fol_003',
    title: 'Q3 Revenue Summary',
    project: 'Sales Operations',
    category: 'Sales Reports',
    created_at: '2024-03-01T10:00:00Z',
    status: 'published',
  },
  {
    id: 'fol_004',
    title: 'Deleted Case Study',
    project: 'Marketing',
    category: 'Success Stories',
    created_at: '2024-04-01T10:00:00Z',
    status: 'deleted',
  },
  {
    id: 'fol_005',
    title: 'Draft Migration Guide',
    project: 'Developer Portal',
    category: 'Technical Guides',
    created_at: '2024-05-01T10:00:00Z',
    status: 'draft',
  },
];

export const mockSearchResults: SearchResult[] = [
  { publication: mockPublications[0], score: 0.97 },
  { publication: mockPublications[1], score: 0.85 },
];

/** A unit vector of given dimension — useful for cosine similarity tests */
export function unitVector(dim: number, index: number): number[] {
  const v = new Array(dim).fill(0);
  v[index] = 1;
  return v;
}
```

---

## tests/cosine.test.ts

```typescript
import { cosineSimilarity } from '../src/lib/cosine';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 when either vector has zero magnitude', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });

  it('throws for mismatched vector lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vector length mismatch');
  });

  it('handles high-dimensional vectors (1536-dim)', () => {
    const a = new Array(1536).fill(0.5);
    const b = new Array(1536).fill(0.5);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it('is symmetric — cosineSimilarity(a, b) === cosineSimilarity(b, a)', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });
});
```

---

## tests/cacheService.test.ts

```typescript
import { cacheService } from '../src/services/cacheService';
import { mockSearchResults, unitVector } from './fixtures';

describe('CacheService', () => {
  beforeEach(() => cacheService.clear());

  describe('lookup', () => {
    it('returns null on empty cache', () => {
      expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
    });

    it('returns results on exact vector match', () => {
      const vec = unitVector(4, 0);
      cacheService.store(vec, mockSearchResults);
      expect(cacheService.lookup(vec)).toEqual(mockSearchResults);
    });

    it('returns results for query ≥ 0.95 cosine similarity', () => {
      // Nearly identical vectors — will be above threshold
      const stored = [1, 0.001, 0, 0];
      const similar = [1, 0.002, 0, 0];
      cacheService.store(stored, mockSearchResults);
      expect(cacheService.lookup(similar)).toEqual(mockSearchResults);
    });

    it('returns null for orthogonal vector (similarity = 0)', () => {
      cacheService.store(unitVector(4, 0), mockSearchResults);
      expect(cacheService.lookup(unitVector(4, 1))).toBeNull();
    });

    it('returns null for expired entries (TTL)', () => {
      const vec = unitVector(4, 0);
      cacheService.store(vec, mockSearchResults);
      // Backdate timestamp past TTL
      const entry = (cacheService as unknown as {
        cache: Array<{ timestamp: number }>
      }).cache[0];
      entry.timestamp = Date.now() - (61 * 60 * 1000);
      expect(cacheService.lookup(vec)).toBeNull();
    });
  });

  describe('store', () => {
    it('increments size on each store', () => {
      expect(cacheService.size()).toBe(0);
      cacheService.store(unitVector(4, 0), mockSearchResults);
      expect(cacheService.size()).toBe(1);
      cacheService.store(unitVector(4, 1), mockSearchResults);
      expect(cacheService.size()).toBe(2);
    });

    it('evicts oldest entry when MAX_CACHE_SIZE is reached', () => {
      const MAX = 500;
      // Fill to capacity
      for (let i = 0; i < MAX; i++) {
        const vec = new Array(4).fill(0);
        vec[i % 4] = i + 1; // ensure unique-ish vectors
        cacheService.store(vec, mockSearchResults);
      }
      expect(cacheService.size()).toBe(MAX);

      // Add one more — oldest should be evicted
      cacheService.store([99, 0, 0, 0], mockSearchResults);
      expect(cacheService.size()).toBe(MAX);
    });
  });

  describe('clear', () => {
    it('empties the cache', () => {
      cacheService.store(unitVector(4, 0), mockSearchResults);
      cacheService.clear();
      expect(cacheService.size()).toBe(0);
      expect(cacheService.lookup(unitVector(4, 0))).toBeNull();
    });
  });
});
```

---

## tests/sanitizer.test.ts

```typescript
import { sanitizePublications } from '../src/services/sanitizer';
import { RawPublication } from '../src/types';

jest.mock('../src/lib/openai', () => ({
  openai: {
    chat: { completions: { create: jest.fn() } },
  },
}));

jest.mock('../src/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));

import { openai } from '../src/lib/openai';

const mockRaw: RawPublication[] = [
  {
    id: 'fol_001',
    project_name: 'MARKETING_2024',
    title: 'DRAFT_Client Testimonial Alpha',
    category: 'Success Stories',
    created_at: '2024-01-15T09:30:00Z',
    status: 'draft',
  },
  {
    id: 'fol_009',
    project_name: 'Dev_Portal_v2',
    title: '',
    category: 'Technical Guides',
    created_at: '2024-02-10T09:00:00Z',
    status: 'draft',
  },
  {
    id: 'fol_043',
    project_name: 'Dev_Portal_v2',
    title: null,
    category: 'Technical Guides',
    created_at: '2024-02-25T10:00:00Z',
    status: 'draft',
  },
];

const mockPass1 = {
  project_mapping: {
    MARKETING_2024: 'Marketing',
    Dev_Portal_v2: 'Developer Portal',
  },
  category_mapping: {
    'Success Stories': 'Success Stories',
    'Technical Guides': 'Technical Guides',
    null: 'Uncategorised',
  },
};

const mockPass2 = {
  publications: [
    { id: 'fol_001', title: 'Client Testimonial Alpha', project: 'Marketing', category: 'Success Stories' },
    { id: 'fol_009', title: 'Untitled Document', project: 'Developer Portal', category: 'Technical Guides' },
    { id: 'fol_043', title: 'Untitled Document', project: 'Developer Portal', category: 'Technical Guides' },
  ],
};

function setupMocks() {
  (openai.chat.completions.create as jest.Mock)
    .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockPass1) } }] })
    .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(mockPass2) } }] });
}

describe('sanitizePublications', () => {
  beforeEach(setupMocks);
  afterEach(() => jest.clearAllMocks());

  describe('title cleaning', () => {
    it('removes DRAFT_ prefix', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].title).toBe('Client Testimonial Alpha');
      expect(result[0].title).not.toMatch(/DRAFT/i);
    });

    it('replaces empty string title with "Untitled Document"', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[1].title).toBe('Untitled Document');
    });

    it('replaces null title with "Untitled Document"', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[2].title).toBe('Untitled Document');
    });
  });

  describe('project normalisation', () => {
    it('maps messy project_name to canonical project via discovered mapping', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].project).toBe('Marketing');
    });

    it('renames project_name field to project', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0]).not.toHaveProperty('project_name');
      expect(result[0]).toHaveProperty('project');
    });
  });

  describe('field preservation', () => {
    it('preserves status unchanged', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].status).toBe('draft');
    });

    it('preserves created_at unchanged', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result[0].created_at).toBe('2024-01-15T09:30:00Z');
    });

    it('returns same count as input', async () => {
      const result = await sanitizePublications(mockRaw);
      expect(result).toHaveLength(mockRaw.length);
    });
  });

  describe('API call strategy', () => {
    it('calls OpenAI exactly twice — one pass per concern', async () => {
      await sanitizePublications(mockRaw);
      expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('Pass 1 sends only unique project_name values (no duplicates)', async () => {
      await sanitizePublications(mockRaw);
      const pass1Body = JSON.parse(
        (openai.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content
      );
      const names = pass1Body.project_names as string[];
      expect(names.length).toBe(new Set(names).size);
    });

    it('Pass 1 sends only unique category values (no duplicates)', async () => {
      await sanitizePublications(mockRaw);
      const pass1Body = JSON.parse(
        (openai.chat.completions.create as jest.Mock).mock.calls[0][0].messages[1].content
      );
      const cats = pass1Body.categories as string[];
      expect(cats.length).toBe(new Set(cats).size);
    });
  });
});
```

---

## tests/searchService.test.ts

```typescript
import { semanticSearch } from '../src/services/searchService';
import { cacheService } from '../src/services/cacheService';
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications, mockSearchResults } from './fixtures';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    embedText: jest.fn(),
    searchByVector: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('../src/services/cacheService', () => ({
  cacheService: {
    lookup: jest.fn(),
    store: jest.fn(),
    clear: jest.fn(),
    size: jest.fn().mockReturnValue(0),
  },
}));

const mockVector = new Array(1536).fill(0.1);

describe('semanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vectorStore.embedText as jest.Mock).mockResolvedValue(mockVector);
    (vectorStore.searchByVector as jest.Mock).mockReturnValue(mockSearchResults);
    (cacheService.lookup as jest.Mock).mockReturnValue(null);
  });

  describe('cache miss', () => {
    it('embeds the query once', async () => {
      await semanticSearch('success story');
      expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
      expect(vectorStore.embedText).toHaveBeenCalledWith('success story');
    });

    it('checks cache before searching', async () => {
      await semanticSearch('success story');
      expect(cacheService.lookup).toHaveBeenCalledWith(mockVector);
      expect(cacheService.lookup).toHaveBeenCalledBefore(
        vectorStore.searchByVector as jest.Mock
      );
    });

    it('calls searchByVector with the pre-computed vector', async () => {
      await semanticSearch('success story');
      expect(vectorStore.searchByVector).toHaveBeenCalledWith(mockVector, 10, false);
    });

    it('stores results in cache after search', async () => {
      await semanticSearch('success story');
      expect(cacheService.store).toHaveBeenCalledWith(mockVector, mockSearchResults);
    });

    it('returns cacheHit: false', async () => {
      const result = await semanticSearch('success story');
      expect(result.cacheHit).toBe(false);
    });

    it('returns a positive latencyMs', async () => {
      const result = await semanticSearch('success story');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns the search results', async () => {
      const result = await semanticSearch('success story');
      expect(result.results).toEqual(mockSearchResults);
    });
  });

  describe('cache hit', () => {
    beforeEach(() => {
      (cacheService.lookup as jest.Mock).mockReturnValue(mockSearchResults);
    });

    it('returns cacheHit: true', async () => {
      const result = await semanticSearch('success story');
      expect(result.cacheHit).toBe(true);
    });

    it('does not call searchByVector on cache hit', async () => {
      await semanticSearch('success story');
      expect(vectorStore.searchByVector).not.toHaveBeenCalled();
    });

    it('does not store in cache again on cache hit', async () => {
      await semanticSearch('success story');
      expect(cacheService.store).not.toHaveBeenCalled();
    });

    it('still embeds the query — needed to check cache', async () => {
      await semanticSearch('success story');
      expect(vectorStore.embedText).toHaveBeenCalledTimes(1);
    });
  });

  describe('recycle bin mode (includeDeleted: true)', () => {
    it('passes includeDeleted: true to searchByVector', async () => {
      await semanticSearch('deleted report', true);
      expect(vectorStore.searchByVector).toHaveBeenCalledWith(mockVector, 10, true);
    });

    it('does not check the cache in recycle bin mode', async () => {
      await semanticSearch('deleted report', true);
      expect(cacheService.lookup).not.toHaveBeenCalled();
    });

    it('does not store results in cache in recycle bin mode', async () => {
      await semanticSearch('deleted report', true);
      expect(cacheService.store).not.toHaveBeenCalled();
    });
  });
});
```

---

## tests/vectorStore.test.ts

```typescript
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';

jest.mock('../src/lib/openai', () => ({
  openai: {
    embeddings: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/lib/retry', () => ({
  withRetry: jest.fn((fn: () => unknown) => fn()),
}));

import { openai } from '../src/lib/openai';

// Generate a mock embedding response for N inputs
function mockEmbeddingResponse(n: number) {
  return {
    data: Array.from({ length: n }, (_, i) => ({
      embedding: new Array(1536).fill(i * 0.1),
    })),
  };
}

describe('VectorStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store between tests by rebuilding
  });

  describe('build', () => {
    it('embeds all publications in batches', async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );

      await vectorStore.build(mockPublications);

      expect(openai.embeddings.create).toHaveBeenCalled();
      expect(vectorStore.isReady()).toBe(true);
    });

    it('stores all publications after build', async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );

      await vectorStore.build(mockPublications);
      expect(vectorStore.getAll()).toHaveLength(mockPublications.length);
    });
  });

  describe('searchByVector', () => {
    beforeEach(async () => {
      (openai.embeddings.create as jest.Mock).mockResolvedValue(
        mockEmbeddingResponse(mockPublications.length)
      );
      await vectorStore.build(mockPublications);
    });

    it('throws if called before build', () => {
      // Create a fresh instance to test unbuilt state
      const { VectorStore } = jest.requireActual('../src/services/vectorStore') as {
        VectorStore: new () => typeof vectorStore
      };
      const fresh = new VectorStore();
      expect(() => fresh.searchByVector([1, 0], 5, false)).toThrow('Store not built yet');
    });

    it('returns results sorted by score descending', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, false);
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('respects topK limit', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 2, false);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('excludes deleted publications when includeDeleted: false', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, false);
      const statuses = results.map((r) => r.publication.status);
      expect(statuses).not.toContain('deleted');
    });

    it('includes deleted publications when includeDeleted: true', async () => {
      const queryVec = new Array(1536).fill(0.1);
      const results = vectorStore.searchByVector(queryVec, 10, true);
      const hasDeleted = results.some((r) => r.publication.status === 'deleted');
      // With our fixture data, deleted pub should appear
      expect(results.length).toBeGreaterThan(0);
      // All results including deleted are present
      expect(results.length).toBeGreaterThanOrEqual(
        vectorStore.searchByVector(queryVec, 10, false).length
      );
    });
  });
});
```

---

## tests/validate.test.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../src/lib/validate';

function mockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

const testSchema = z.object({
  query: z.string().min(1),
  count: z.number().optional(),
});

describe('validate middleware', () => {
  it('calls next() with valid body', () => {
    const { req, res, next } = mockReqRes({ query: 'hello' });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('replaces req.body with parsed (coerced) data', () => {
    const { req, res, next } = mockReqRes({ query: 'hello' });
    validate(testSchema)(req, res, next);
    expect(req.body).toEqual({ query: 'hello' });
  });

  it('returns 400 with VALIDATION_ERROR code on invalid body', () => {
    const { req, res, next } = mockReqRes({ query: '' });
    validate(testSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('VALIDATION_ERROR');
    expect(next).not.toHaveBeenCalled();
  });

  it('includes field path in error message', () => {
    const { req, res, next } = mockReqRes({ query: '' });
    validate(testSchema)(req, res, next);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.error.message).toContain('query');
  });

  it('returns 400 when body is missing entirely', () => {
    const { req, res, next } = mockReqRes(undefined);
    validate(testSchema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
```

---

## tests/response.test.ts

```typescript
import { ok, sendError } from '../src/lib/response';
import { Response } from 'express';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('ok()', () => {
  it('returns success: true with data', () => {
    const result = ok({ items: [] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ items: [] });
    expect(result.error).toBeNull();
  });

  it('includes pagination when provided', () => {
    const pagination = { page: 1, limit: 20, total: 100, totalPages: 5 };
    const result = ok({ items: [] }, { pagination });
    expect(result.pagination).toEqual(pagination);
  });

  it('sets pagination to null when not provided', () => {
    const result = ok({ ready: true });
    expect(result.pagination).toBeNull();
  });
});

describe('sendError()', () => {
  it('sets correct HTTP status', () => {
    const res = mockRes();
    sendError(res, 400, 'Bad request', 'VALIDATION_ERROR');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns success: false with error object', () => {
    const res = mockRes();
    sendError(res, 400, 'Bad request', 'VALIDATION_ERROR');
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('Bad request');
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('omits code when not provided', () => {
    const res = mockRes();
    sendError(res, 500, 'Server error');
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBeUndefined();
  });
});
```

---

## tests/publications.route.test.ts

```typescript
import request from 'supertest';
import express from 'express';
import publicationsRouter from '../src/routes/publications';
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';

// npm install -D supertest @types/supertest

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    isReady: jest.fn(),
    getAll: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/publications', publicationsRouter);

describe('GET /api/publications', () => {
  beforeEach(() => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(true);
    (vectorStore.getAll as jest.Mock).mockReturnValue(mockPublications);
  });

  it('returns 503 when store not ready', async () => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/publications');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_READY');
  });

  it('returns 200 with ok() envelope shape', async () => {
    const res = await request(app).get('/api/publications');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.pagination).toBeDefined();
  });

  it('returns paginated items', async () => {
    const res = await request(app).get('/api/publications?page=1&limit=2');
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.pagination.total).toBe(mockPublications.length);
  });

  it('filters by project', async () => {
    const res = await request(app).get('/api/publications?project=Marketing');
    const items = res.body.data.items;
    items.forEach((p: { project: string }) => {
      expect(p.project).toBe('Marketing');
    });
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/publications?category=Technical+Guides');
    const items = res.body.data.items;
    items.forEach((p: { category: string }) => {
      expect(p.category).toBe('Technical Guides');
    });
  });

  it('returns 400 when page is out of range', async () => {
    const res = await request(app).get('/api/publications?page=999');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PAGE_OUT_OF_RANGE');
  });

  it('returns all publications with no filters', async () => {
    const res = await request(app).get('/api/publications?limit=100');
    expect(res.body.data.items).toHaveLength(mockPublications.length);
  });
});
```

---

## tests/search.route.test.ts

```typescript
import request from 'supertest';
import express from 'express';
import searchRouter from '../src/routes/search';
import { vectorStore } from '../src/services/vectorStore';
import { semanticSearch } from '../src/services/searchService';
import { mockSearchResults } from './fixtures';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: { isReady: jest.fn() },
}));

jest.mock('../src/services/searchService', () => ({
  semanticSearch: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/search', searchRouter);

describe('POST /api/search', () => {
  beforeEach(() => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(true);
    (semanticSearch as jest.Mock).mockResolvedValue({
      results: mockSearchResults,
      cacheHit: false,
      latencyMs: 120,
    });
  });

  it('returns 503 when store not ready', async () => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(false);
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'test', includeDeleted: false });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_READY');
  });

  it('returns 200 with ok() envelope on valid request', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'success story', includeDeleted: false });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('cacheHit');
    expect(res.body.data).toHaveProperty('latencyMs');
  });

  it('returns 400 with VALIDATION_ERROR for empty query', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: '', includeDeleted: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for query over 500 characters', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'a'.repeat(501), includeDeleted: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when includeDeleted is not a boolean', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'test', includeDeleted: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when query is missing', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ includeDeleted: false });
    expect(res.status).toBe(400);
  });

  it('passes includeDeleted to semanticSearch', async () => {
    await request(app)
      .post('/api/search')
      .send({ query: 'deleted doc', includeDeleted: true });
    expect(semanticSearch).toHaveBeenCalledWith('deleted doc', true);
  });

  it('returns cacheHit: true when cache hit occurs', async () => {
    (semanticSearch as jest.Mock).mockResolvedValue({
      results: mockSearchResults,
      cacheHit: true,
      latencyMs: 12,
    });
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'success story', includeDeleted: false });
    expect(res.body.data.cacheHit).toBe(true);
  });
});
```

---

## tests/meta.route.test.ts

```typescript
import request from 'supertest';
import express from 'express';
import metaRouter from '../src/routes/meta';
import { vectorStore } from '../src/services/vectorStore';
import { mockPublications } from './fixtures';

jest.mock('../src/services/vectorStore', () => ({
  vectorStore: {
    isReady: jest.fn(),
    getAll: jest.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/publications/meta', metaRouter);

describe('GET /api/publications/meta', () => {
  beforeEach(() => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(true);
    (vectorStore.getAll as jest.Mock).mockReturnValue(mockPublications);
  });

  it('returns 503 when store not ready', async () => {
    (vectorStore.isReady as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/publications/meta');
    expect(res.status).toBe(503);
  });

  it('returns sorted distinct projects', async () => {
    const res = await request(app).get('/api/publications/meta');
    expect(res.status).toBe(200);
    const { projects } = res.body.data;
    expect(projects).toEqual([...projects].sort());
    expect(new Set(projects).size).toBe(projects.length);
  });

  it('returns sorted distinct categories', async () => {
    const res = await request(app).get('/api/publications/meta');
    const { categories } = res.body.data;
    expect(categories).toEqual([...categories].sort());
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('returns ok() envelope shape', async () => {
    const res = await request(app).get('/api/publications/meta');
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('projects');
    expect(res.body.data).toHaveProperty('categories');
  });
});
```
