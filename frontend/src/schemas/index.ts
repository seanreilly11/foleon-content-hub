import { z } from 'zod';

// ─── Shared ───────────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthDataSchema = z.object({
  ready: z.boolean(),
  startupStage: z.string().optional(),
});

// ─── Meta ─────────────────────────────────────────────────────────────────────

export const metaDataSchema = z.object({
  projects: z.array(z.string()),
  categories: z.array(z.string()),
});

// ─── Publications ─────────────────────────────────────────────────────────────

export const publicationSchema = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string(),
  category: z.string(),
  created_at: z.string(),
  status: z.enum(['published', 'draft', 'archived', 'deleted']),
});

export const publicationsDataSchema = z.object({
  items: z.array(publicationSchema),
});

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchResultSchema = z.object({
  publication: publicationSchema,
  score: z.number(),
});

export const searchDataSchema = z.object({
  items: z.array(searchResultSchema),
  cacheHit: z.boolean(),
  latencyMs: z.number(),
});

// ─── Request schemas ──────────────────────────────────────────────────────────

// Mirrors the backend searchRequestSchema — keep in sync if the contract changes.
export const searchRequestSchema = z.object({
  query: z.string(),
  includeDeleted: z.boolean(),
});

// ─── Sorting ─────────────────────────────────────────────────────────────────

export const BROWSE_SORT_VALUES = ['date-desc', 'date-asc', 'title-asc', 'title-desc', 'project-asc', 'status'] as const;
export const SEARCH_SORT_VALUES = ['relevance', 'date-desc', 'date-asc', 'title-asc', 'title-desc'] as const;
export type BrowseSort = typeof BROWSE_SORT_VALUES[number];
export type SearchSort = typeof SEARCH_SORT_VALUES[number];

// ─── Inferred types ───────────────────────────────────────────────────────────

export type HealthData        = z.infer<typeof healthDataSchema>;
export type MetaData          = z.infer<typeof metaDataSchema>;
export type PublicationsData  = z.infer<typeof publicationsDataSchema>;
export type SearchData        = z.infer<typeof searchDataSchema>;
export type SearchRequest     = z.infer<typeof searchRequestSchema>;
export type Publication       = z.infer<typeof publicationSchema>;
export type SearchResult      = z.infer<typeof searchResultSchema>;
export type Pagination        = z.infer<typeof paginationSchema>;
