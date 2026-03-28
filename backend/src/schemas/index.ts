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

export const rawPublicationArraySchema = z.array(rawPublicationSchema);

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

// ─── Startup stages ──────────────────────────────────────────────────────────
// Must match the keys in the frontend's STARTUP_STAGE_LABELS constant.

export const STARTUP_STAGES = ['initialising', 'sanitising', 'embedding', 'ready'] as const;
export type StartupStage = typeof STARTUP_STAGES[number];

// ─── Sanitizer internal schemas ──────────────────────────────────────────────

export const mappingsSchema = z.object({
  project_mapping: z.record(z.string()),
  category_mapping: z.record(z.string()),
});

const cleanedPublicationSchema = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string(),
  category: z.string(),
});

export const cleanedPublicationsResponseSchema = z.object({
  publications: z.array(cleanedPublicationSchema),
});

// ─── Request body schemas ────────────────────────────────────────────────────

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, 'query must be a non-empty string').max(500),
  includeDeleted: z.boolean().default(false),
});

// ─── Response shapes ─────────────────────────────────────────────────────────

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  cacheHit: z.boolean(),
  latencyMs: z.number(),
});

export const healthResponseSchema = z.object({
  ready: z.boolean(),
  startupStage: z.string().optional(),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
// Import these via types/index.ts — never import from schemas directly in app code

export type RawPublication  = z.infer<typeof rawPublicationSchema>;
export type Publication     = z.infer<typeof publicationSchema>;
export type SearchResult    = z.infer<typeof searchResultSchema>;
export type Pagination      = z.infer<typeof paginationSchema>;
export type VectorEntry     = z.infer<typeof vectorEntrySchema>;
export type CacheEntry      = z.infer<typeof cacheEntrySchema>;
export type SearchRequest   = z.infer<typeof searchRequestSchema>;
export type SearchResponse  = z.infer<typeof searchResponseSchema>;
export type HealthResponse  = z.infer<typeof healthResponseSchema>;
export type Mappings        = z.infer<typeof mappingsSchema>;
