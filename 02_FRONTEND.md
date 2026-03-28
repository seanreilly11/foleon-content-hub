# Frontend Implementation Spec (v3 — Senior Engineering)

## Engineering Principles

All frontend code must follow these principles. They are enforced — not aspirational.

**Single Responsibility** — Fetch hooks fetch. UI hooks manage state. Components
render. `ProjectFilter` is the one documented exception where internal fetching is
intentional and encapsulated — this pattern should not spread to other components.

**DRY** — `apiGet` and `apiPost` are the only fetch functions. `ApiError` is defined
once. Query keys follow a consistent structure. Never duplicate fetch logic or error
handling between hooks.

**Two-layer hook pattern** — Every data concern has a raw fetch hook (`useFetchX`)
and a UI state hook (`useX`). Never mix `useQuery`/`useMutation` with `useState` for
UI concerns in the same hook.

**No prop drilling past one level** — Filter state lives in `usePublications`. Data
needs more than one level deep belongs in a hook, not threaded through props.

**Query keys are structured objects** — Always `['resource', { param1, param2 }]`.
This makes `invalidateQueries` predictable and broad invalidation safe.

**TypeScript is documentation** — Explicit return types on all functions. Every API
response has an interface in `types/index.ts`. No `any`. `as Type` only as last resort
with a comment.

**`placeholderData` on paginated queries** — Any `useQuery` that pages or filters must
use `placeholderData: (prev) => prev` to prevent skeleton flashes on navigation.

---

## src/constants/index.ts

All magic values in one place. Import from here — never hardcode values inline.

```typescript
// ─── Search ───────────────────────────────────────────────────────────────────

/** Milliseconds to wait after the user stops typing before firing a search */
export const SEARCH_DEBOUNCE_MS = 400;

/** Maximum characters allowed in a search query */
export const SEARCH_MAX_LENGTH = 500;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;

/** Maximum publications fetched per request */
export const MAX_LIMIT = 200;

// ─── Server polling ───────────────────────────────────────────────────────────

/** How often to poll /health during backend startup */
export const HEALTH_POLL_INTERVAL_MS = 2000;

// ─── Cache ────────────────────────────────────────────────────────────────────

/** React Query stale time for stable resources (meta, publications list) */
export const STABLE_STALE_TIME = Infinity;

// ─── Initialising screen ─────────────────────────────────────────────────────

export const STARTUP_STAGE_LABELS: Record<string, string> = {
  connecting:   'Connecting to server...',
  initialising: 'Starting up...',
  sanitising:   'Healing legacy data with AI...',
  embedding:    'Building semantic search index...',
};

export const STARTUP_STAGE_ORDER = [
  'connecting',
  'initialising',
  'sanitising',
  'embedding',
] as const;

// ─── Category styling ─────────────────────────────────────────────────────────
// Deterministic colour assignment — any category string maps to a consistent
// colour from the palette. Works on any dataset without hardcoding category names.

const CATEGORY_BADGE_PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
] as const;

const CATEGORY_DOT_PALETTE = [
  'bg-violet-400',
  'bg-blue-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-pink-400',
  'bg-cyan-400',
  'bg-orange-400',
  'bg-indigo-400',
] as const;

/** Simple deterministic hash — same string always returns the same index */
function categoryHash(category: string): number {
  return category
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

/**
 * Returns a badge className for any category string.
 * Deterministic — same category always gets the same colour.
 * Unknown categories get a colour from the palette, never a grey fallback.
 */
export function getCategoryStyle(category: string): string {
  if (!category) return 'bg-gray-100 text-gray-500';
  return CATEGORY_BADGE_PALETTE[categoryHash(category) % CATEGORY_BADGE_PALETTE.length];
}

/**
 * Returns a dot className for any category string.
 * Used in sidebar filter — same colour as the badge for that category.
 */
export function getCategoryDot(category: string): string {
  if (!category) return 'bg-gray-300';
  return CATEGORY_DOT_PALETTE[categoryHash(category) % CATEGORY_DOT_PALETTE.length];
}

export const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  draft:     'bg-yellow-50 text-yellow-600 border border-yellow-200',
  archived:  'bg-gray-50 text-gray-500 border border-gray-200',
  deleted:   'bg-red-50 text-red-400 border border-red-200',
};
```

---

## Setup

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install tailwindcss @tailwindcss/vite @tanstack/react-query
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
```

### src/index.css
```css
@import "tailwindcss";
```

### tailwind.config.ts
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          500: '#3b63f7',
          600: '#2248e5',
          700: '#1a38c0',
        },
        surface: '#f8f9fc',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
};
export default config;
```

Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet" />
```

---

## src/types/index.ts

Pure re-export file — all types are inferred from Zod schemas in `src/schemas/index.ts`.
Never define a type here directly. Import types in the rest of the app as:
`import { Publication } from '../types'`

```typescript
// Only export types that components and hooks use as prop/return types.
// Full API result types (ApiResult<T>) are handled internally in hooks.
export type {
  Publication,
  SearchResult,
  SearchData,
  Pagination,
} from '../schemas';
```

---

## src/lib/api.ts

`parseResponse` validates the full envelope then unwraps it — callers receive
`{ data, pagination }` directly. The `success` discriminator is an internal transport
concern that never leaks outside this file.

```typescript
import { z } from 'zod';
import { paginationSchema } from '../schemas';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public serverMessage: string,
    public code?: string
  ) {
    super(`HTTP ${status}: ${serverMessage}`);
    this.name = 'ApiError';
  }
}

// Internal envelope schema — built dynamically around each data schema.
// Never exported — callers only ever see the unwrapped payload.
const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

function envelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      pagination: paginationSchema.nullable(),
      error: z.null(),
    }),
    z.object({
      success: z.literal(false),
      data: z.null(),
      pagination: z.null(),
      error: apiErrorSchema,
    }),
  ]);
}

export interface ApiResult<T> {
  data: T;
  pagination: z.infer<typeof paginationSchema> | null;
}

/**
 * Three-gate response handler:
 * Gate 1 — HTTP: non-2xx → throws ApiError with server message
 * Gate 2 — Envelope: success: false → throws ApiError with app error
 * Gate 3 — Schema: validates data shape → throws ZodError on mismatch
 * On success: unwraps and returns { data, pagination } — envelope is gone.
 */
async function parseResponse<T extends z.ZodTypeAny>(
  res: Response,
  dataSchema: T
): Promise<ApiResult<z.infer<T>>> {
  // Gate 1 — HTTP level
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.message ?? body?.error ?? res.statusText,
      body?.error?.code
    );
  }

  const json = await res.json();

  // Gate 2 — Envelope level
  if (!json.success) {
    throw new ApiError(
      res.status,
      json.error?.message ?? 'Unknown error',
      json.error?.code
    );
  }

  // Gate 3 — Data schema validation
  const parsed = envelopeSchema(dataSchema).parse(json);

  // Unwrap — callers never see the envelope
  if (parsed.success) {
    return {
      data: parsed.data as z.infer<T>,
      pagination: parsed.pagination,
    };
  }

  // Unreachable — discriminated union guarantees success: true here,
  // but TypeScript needs the explicit throw to narrow the return type.
  throw new ApiError(res.status, 'Unexpected response shape');
}

/**
 * @example
 * queryFn: ({ signal }) =>
 *   apiGet('/api/publications', { page: '1' }, publicationsDataSchema, { signal })
 * // returns { data: { items: Publication[] }, pagination: Pagination | null }
 */
export async function apiGet<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string> | undefined,
  dataSchema: T,
  options?: { headers?: Record<string, string>; signal?: AbortSignal }
): Promise<ApiResult<z.infer<T>>> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) url.search = new URLSearchParams(params).toString();

  const res = await fetch(url.toString(), {
    headers: options?.headers,
    signal: options?.signal,
  });

  return parseResponse(res, dataSchema);
}

/**
 * @example
 * mutationFn: (body: SearchRequest) =>
 *   apiPost('/api/search', body, searchDataSchema)
 * // returns { data: { items: SearchResult[], cacheHit: boolean, latencyMs: number }, pagination: null }
 */
export async function apiPost<TBody, T extends z.ZodTypeAny>(
  path: string,
  body: TBody,
  dataSchema: T,
  options?: { headers?: Record<string, string>; signal?: AbortSignal }
): Promise<ApiResult<z.infer<T>>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  return parseResponse(res, dataSchema);
}
```

---

## src/schemas/index.ts

Data schemas only — no envelope wrappers. The envelope is validated and unwrapped
inside `api.ts`. Callers receive `{ data, pagination }` directly and never interact
with the `success` field outside `api.ts`.

```typescript
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

// ─── Inferred types ───────────────────────────────────────────────────────────

export type HealthData        = z.infer<typeof healthDataSchema>;
export type MetaData          = z.infer<typeof metaDataSchema>;
export type PublicationsData  = z.infer<typeof publicationsDataSchema>;
export type SearchData        = z.infer<typeof searchDataSchema>;
export type SearchRequest     = z.infer<typeof searchRequestSchema>;
export type Publication       = z.infer<typeof publicationSchema>;
export type SearchResult      = z.infer<typeof searchResultSchema>;
export type Pagination        = z.infer<typeof paginationSchema>;
```

---

## src/hooks/useFetchHealth.ts

Raw query hook for the `/health` endpoint. Polls every 2s until `ready: true`,
then stops automatically via `refetchInterval` returning `false`.

```typescript
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { healthResponseSchema } from '../schemas';
import { HEALTH_POLL_INTERVAL_MS, STABLE_STALE_TIME } from '../constants';

type HealthResponse = z.infer<typeof healthResponseSchema>;

export function useFetchHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ['health'],
    queryFn: ({ signal }) =>
      apiGet('/health', undefined, healthResponseSchema, { signal }),
    refetchInterval: (query) => query.state.data?.data?.ready ? false : HEALTH_POLL_INTERVAL_MS,
    staleTime: Infinity,
    retry: false,
  });
}
```

---

## src/hooks/useServerReady.ts

UI state hook — calls `useFetchHealth` and returns clean derived booleans.

```typescript
import { useFetchHealth } from './useFetchHealth';

export function useServerReady() {
  const { data } = useFetchHealth();

  // data is the full envelope — data.data is the payload when success: true
  const payload = data?.success ? data.data : null;

  return {
    ready: payload?.ready ?? false,
    startupStage: payload?.startupStage ?? 'connecting',
  };
}
```

---

## src/hooks/useFetchMeta.ts

Raw query hook for filter metadata — distinct projects and categories from the full
dataset. Separate from publications so the sidebar renders independently and filter
options are always accurate regardless of which page of publications is loaded.

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { metaDataSchema } from '../schemas';
import { STABLE_STALE_TIME } from '../constants';

type MetaResponse = z.infer<typeof metaResponseSchema>;

export function useFetchMeta() {
  return useQuery<MetaResponse, Error>({
    queryKey: ['publications-meta'],
    queryFn: ({ signal }) =>
      apiGet('/api/publications/meta', undefined, metaResponseSchema, { signal }),
    staleTime: Infinity,
  });
}
```

---

## src/hooks/useFetchPublications.ts

Raw query hook for the paginated publications list. Filter params and page are part
of the queryKey — React Query re-fetches automatically whenever any of them change.
Previously fetched combinations are cached, so navigating back to a previous filter
or page is instant.

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { publicationsDataSchema } from '../schemas';
import { PAGE_SIZE } from '../constants';

interface PublicationsParams {
  page: number;
  project: string;
  category: string;
}

export function useFetchPublications({ page, project, category }: PublicationsParams) {
  // apiGet returns ApiResult<PublicationsData> — { data: { items }, pagination }
  return useQuery({
    queryKey: ['publications', { page, project, category }],
    queryFn: ({ signal }) =>
      apiGet(
        '/api/publications',
        {
          page: String(page),
          limit: String(PAGE_SIZE),
          ...(project && { project }),
          ...(category && { category }),
        },
        publicationsDataSchema,
        { signal }
      ),
    placeholderData: (prev) => prev,
  });
}
```

---

## src/hooks/usePublications.ts

UI state hook — owns page/filter state and passes it into `useFetchPublications`.
The queryKey in `useFetchPublications` reacts to state changes automatically —
no manual re-fetch wiring needed.

```typescript
import { useState, useCallback } from 'react';
import { useFetchPublications } from './useFetchPublications';
import { Publication } from '../types';

export function usePublications() {
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data, isLoading, error } = useFetchPublications({
    page,
    project: selectedProject,
    category: selectedCategory,
  });

  // data is ApiResult<PublicationsData> — envelope already unwrapped by apiGet
  const publications: Publication[] = data?.data?.items ?? [];
  const pagination = data?.pagination ?? null;

  const handleProjectChange = useCallback((p: string) => {
    setSelectedProject(p);
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((c: string) => {
    setSelectedCategory(c);
    setPage(1);
  }, []);

  return {
    publications,
    total: pagination?.total ?? 0,
    totalPages: pagination?.totalPages ?? 0,
    page,
    setPage,
    selectedProject,
    setSelectedProject: handleProjectChange,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
```

---

## src/hooks/useSearchMutation.ts

Raw mutation hook — just the network concern. Takes a `SearchRequest` and posts to
`/api/search`. Reusable if search is ever needed outside the main search flow.

```typescript
import { useMutation } from '@tanstack/react-query';
import { apiPost, ApiResult } from '../lib/api';
import {
  searchDataSchema,
  searchRequestSchema,
  SearchData,
  SearchRequest,
} from '../schemas';

export type { SearchRequest };

export function useSearchMutation() {
  // useMutation<TData, TError, TVariables>
  // TData is ApiResult<SearchData> — { data: { items, cacheHit, latencyMs }, pagination: null }
  return useMutation<ApiResult<SearchData>, Error, SearchRequest>({
    mutationFn: (body) => apiPost('/api/search', body, searchDataSchema),
  });
}
```

---

## src/hooks/useDebounce.ts

Generic debounce hook. Keeps debounce logic in one place — import wherever needed.

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
```

---

## src/hooks/useSearch.ts

UI state hook — calls `useSearchMutation` and layers query string state, the recycle
bin toggle, and clear behaviour on top.

```typescript
import { useState, useEffect } from 'react';
import { useSearchMutation } from './useSearchMutation';
import { useDebounce } from './useDebounce';
import { SEARCH_DEBOUNCE_MS } from '../constants';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const { mutate, data: results, isPending, error, reset } = useSearchMutation();

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Fire search automatically when the debounced query changes.
  // The user doesn't need to press Enter — typing naturally triggers search
  // after SEARCH_DEBOUNCE_MS of inactivity.
  useEffect(() => {
    if (debouncedQuery.trim()) {
      mutate({ query: debouncedQuery.trim(), includeDeleted });
    } else {
      reset();
    }
  }, [debouncedQuery, includeDeleted, mutate, reset]);

  const clearSearch = () => {
    setQuery('');
    setIncludeDeleted(false);
    reset();
  };

  const handleIncludeDeletedChange = (value: boolean) => {
    setIncludeDeleted(value);
    // Re-run immediately with new flag if there's an active query
    if (debouncedQuery.trim()) {
      mutate({ query: debouncedQuery.trim(), includeDeleted: value });
    }
  };

  // results is ApiResult<SearchData> — envelope already unwrapped
  return {
    query,
    setQuery,
    results: results?.data ?? null,
    isLoading: isPending,
    error: error ? (error as Error).message : null,
    clearSearch,
    includeDeleted,
    setIncludeDeleted: handleIncludeDeletedChange,
  };
}
```

---

## src/components/InitialisingScreen.tsx

Shown while the backend's AI pipeline is still running. Much better UX than a 503 error.

```typescript
import React from 'react';
import { STARTUP_STAGE_LABELS, STARTUP_STAGE_ORDER } from '../constants';

interface Props {
  stage: string;
}

export const InitialisingScreen: React.FC<Props> = ({ stage }) => {
  const label = STAGE_LABELS[stage] ?? 'Initialising...';
  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="min-h-screen bg-surface font-sans flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        {/* Animated logo */}
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M4 6h16M4 10h16M4 14h10" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Content Hub</h1>
        <p className="text-sm text-gray-500 mb-6">{label}</p>

        {/* Stage progress dots */}
        <div className="flex justify-center gap-2">
          {STARTUP_STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                i <= stageIndex ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          First startup takes ~20s to build the AI search index
        </p>
      </div>
    </div>
  );
};
```

---

## src/components/ui/Button.tsx

```typescript
import React from 'react';

const VARIANT_STYLES = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:   'text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed',
  outline: 'border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed',
} as const;

const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_STYLES;
  size?: keyof typeof SIZE_STYLES;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'ghost', size = 'sm', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-500 focus-visible:ring-offset-1
        ${VARIANT_STYLES[variant]}
        ${SIZE_STYLES[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
```

---

## src/components/ui/IconButton.tsx

```typescript
import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // required — icon-only buttons must have accessible labels
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-lg p-1.5
        text-gray-400 hover:text-gray-600 hover:bg-gray-100
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-brand-500 focus-visible:ring-offset-1
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
```

---

## src/components/ui/Input.tsx

```typescript
import React from 'react';
import { SEARCH_MAX_LENGTH } from '../../constants';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ leftSlot, rightSlot, className = '', ...props }, ref) => (
    <div className="relative w-full">
      {leftSlot && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          {leftSlot}
        </span>
      )}
      <input
        ref={ref}
        maxLength={SEARCH_MAX_LENGTH}
        className={`
          w-full py-3.5 rounded-xl border border-gray-200 bg-white
          text-gray-900 placeholder-gray-400 text-[15px]
          shadow-sm transition-shadow
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
          ${leftSlot ? 'pl-11' : 'pl-4'}
          ${rightSlot ? 'pr-28' : 'pr-4'}
          ${className}
        `}
        {...props}
      />
      {rightSlot && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {rightSlot}
        </div>
      )}
    </div>
  )
);

Input.displayName = 'Input';
```

---

## src/components/ui/Badge.tsx

```typescript
import React from 'react';

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

// Badge takes className for colour — colours are data-driven from constants maps
// so the component stays unaware of domain concepts like categories or statuses.
export const Badge: React.FC<BadgeProps> = ({ className = '', children }) => (
  <span className={`
    inline-flex items-center px-2.5 py-1 rounded-full
    text-xs font-semibold capitalize
    ${className}
  `}>
    {children}
  </span>
);
```

---

## src/components/ui/index.ts

```typescript
export { Button }     from './Button';
export { IconButton } from './IconButton';
export { Input }      from './Input';
export { Badge }      from './Badge';
```

---

## src/components/SearchBar.tsx

```typescript
import React from 'react';
import { SEARCH_MAX_LENGTH } from '../constants';

interface Props {
  query: string;
  onChange: (q: string) => void;
  onSearch: (q: string) => void;
  onClear: () => void;
  loading: boolean;
}

export const SearchBar: React.FC<Props> = ({ query, onChange, onSearch, onClear, loading }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch(query);
    if (e.key === 'Escape') onClear();
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Search: "success story", "developer guide", "revenue"...'
        maxLength={SEARCH_MAX_LENGTH}
        className="w-full pl-11 pr-28 py-3.5 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-[15px] transition-shadow"
        aria-label="Semantic search"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {loading && <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
        {query && !loading && (
          <button onClick={onClear} className="text-gray-400 hover:text-gray-600 p-1 rounded" aria-label="Clear">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          onClick={() => onSearch(query)}
          disabled={!query.trim() || loading}
          className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Search
        </button>
      </div>
    </div>
  );
};
```

---

## src/components/RecycleBinToggle.tsx

The "Search in Recycle Bin" toggle. Only visible when a search is active.
Triggers a fresh search with `includeDeleted: true`.

```typescript
import React from 'react';
import { Button } from './ui';

interface Props {
  enabled: boolean;
  onChange: (v: boolean) => void;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const RecycleBinToggle: React.FC<Props> = ({ enabled, onChange }) => (
  <Button
    variant="outline"
    size="sm"
    onClick={() => onChange(!enabled)}
    title="Include deleted publications in search results"
    className={enabled ? 'bg-red-50 border-red-200 text-red-600 hover:border-red-300' : ''}
  >
    <TrashIcon />
    {enabled ? 'Searching recycle bin' : 'Search in recycle bin'}
  </Button>
);
```

---

## src/components/StatusBanner.tsx

```typescript
import React from 'react';
import { SearchResponse } from '../types';

interface Props {
  response: SearchResponse;
  inRecycleBin: boolean;
}

export const StatusBanner: React.FC<Props> = ({ response, inRecycleBin }) => {
  if (inRecycleBin) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-fit">
        <span>🗑️</span>
        <span className="font-semibold">Recycle bin search</span>
        <span className="text-red-400">— {response.results.length} deleted results in {response.latencyMs}ms</span>
      </div>
    );
  }

  if (response.cacheHit) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 w-fit">
        <span>⚡</span>
        <span className="font-semibold">Instant result</span>
        <span className="text-emerald-500">— served from semantic cache in {response.latencyMs}ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-4 py-2 w-fit">
      <span>🔍</span>
      <span className="font-semibold">Semantic search</span>
      <span className="text-brand-500">— {response.results.length} results in {response.latencyMs}ms</span>
    </div>
  );
};
```

---

## src/components/PublicationCard.tsx

```typescript
import React from 'react';
import { Publication } from '../types';
import { getCategoryStyle, STATUS_STYLES } from '../constants';
import { Badge } from './ui';

interface Props {
  publication: Publication;
  score?: number;
}

export const PublicationCard: React.FC<Props> = ({ publication, score }) => {
  const categoryStyle = getCategoryStyle(publication.category);
  const statusStyle = STATUS_STYLES[publication.status] ?? 'bg-gray-100 text-gray-500';
  const isDeleted = publication.status === 'deleted';

  return (
    <div className={`group flex flex-col gap-3 p-5 rounded-xl border bg-white shadow-sm
      transition-all duration-200 hover:shadow-md
      ${isDeleted ? 'border-red-100 opacity-75 hover:border-red-200' : 'border-gray-100 hover:border-brand-200'}
    `}>
      <div className="flex items-center justify-between gap-2">
        <Badge className={categoryStyle}>{publication.category}</Badge>
        {score !== undefined && (
          <div className="flex items-center gap-1.5 shrink-0" title={`Relevance: ${(score * 100).toFixed(0)}%`}>
            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.round(score * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400 tabular-nums">{(score * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      <h3 className={`text-[15px] font-semibold leading-snug line-clamp-2 transition-colors
        ${isDeleted ? 'text-gray-500' : 'text-gray-900 group-hover:text-brand-600'}
      `}>
        {publication.title}
      </h3>

      <div className="flex items-center justify-between mt-auto gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge className="bg-gray-100 text-gray-600">{publication.project}</Badge>
          <Badge className={statusStyle}>{publication.status}</Badge>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(publication.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
};
```

---

## src/components/SkeletonCard.tsx

```typescript
import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="flex flex-col gap-3 p-5 rounded-xl border border-gray-100 bg-white shadow-sm animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-6 w-28 bg-gray-100 rounded-full" />
      <div className="h-1.5 w-12 bg-gray-100 rounded-full" />
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
    </div>
    <div className="flex justify-between items-center mt-auto">
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
      </div>
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  </div>
);
```

---

## src/components/ProjectFilter.tsx

Fetches its own filter metadata via `useFetchMeta` — fully self-contained.
App.tsx does not need to pass projects/categories as props, keeping the concern
strictly within this component.

```typescript
import React from 'react';
import { useFetchMeta } from '../hooks/useFetchMeta';
import { getCategoryDot } from '../constants';
import { Button } from './ui';

interface Props {
  selectedProject: string;
  selectedCategory: string;
  onProjectChange: (p: string) => void;
  onCategoryChange: (c: string) => void;
  totalCount: number;
}

export const ProjectFilter: React.FC<Props> = ({
  selectedProject, selectedCategory,
  onProjectChange, onCategoryChange, totalCount,
}) => {
  const { data } = useFetchMeta();
  // data is ApiResult<MetaData> — no envelope unwrapping needed
  const projects = data?.data?.projects ?? [];
  const categories = data?.data?.categories ?? [];

  return (
  <div className="flex flex-col gap-6">
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Category</p>
      <button onClick={() => onCategoryChange('')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${!selectedCategory ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
        <span>All</span>
        <span className="text-xs text-gray-400 tabular-nums">{totalCount}</span>
      </button>
      {categories.map((cat) => (
        <button key={cat} onClick={() => onCategoryChange(cat)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${selectedCategory === cat ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_DOTS[cat] ?? 'bg-gray-300'}`} />
          <span>{cat}</span>
        </button>
      ))}
    </div>
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Project</p>
      <button onClick={() => onProjectChange('')} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left ${!selectedProject ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
        <span>All Projects</span>
      </button>
      {projects.map((project) => (
        <button key={project} onClick={() => onProjectChange(project)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedProject === project ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
          {project}
        </button>
      ))}
    </div>
  </div>
);
```

---

## src/components/Pagination.tsx

```typescript
import React from 'react';
import { Button, IconButton } from './ui';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const Pagination: React.FC<Props> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <div className="flex items-center gap-1 justify-center mt-8">
      <IconButton
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft />
      </IconButton>

      {visible.reduce<React.ReactNode[]>((acc, p, i, arr) => {
        if (i > 0 && p - (arr[i - 1] as number) > 1) {
          acc.push(
            <span key={`dots-${p}`} className="px-1 text-gray-300 text-sm">…</span>
          );
        }
        acc.push(
          <Button
            key={p}
            variant={p === page ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(p)}
            className="w-9 h-9 p-0"
          >
            {p}
          </Button>
        );
        return acc;
      }, [])}

      <IconButton
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
      >
        <ChevronRight />
      </IconButton>
    </div>
  );
};
```

---

## src/components/PublicationList.tsx

```typescript
import React from 'react';
import { Publication, SearchResult } from '../types';
import { PublicationCard } from './PublicationCard';
import { SkeletonCard } from './SkeletonCard';
import { Pagination } from './Pagination';

interface Props {
  publications?: Publication[];
  searchResults?: SearchResult[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  isSearchMode: boolean;
}

export const PublicationList: React.FC<Props> = ({
  publications, searchResults, loading,
  page, totalPages, total, onPageChange, isSearchMode,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (isSearchMode && searchResults !== undefined) {
    if (searchResults.length === 0) {
      return (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium text-gray-600">No results found</p>
          <p className="text-sm mt-1">Try a different search term or browse all publications</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {searchResults.map(({ publication, score }) => (
          <PublicationCard key={publication.id} publication={publication} score={score} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {(publications ?? []).map((pub) => (
          <PublicationCard key={pub.id} publication={pub} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
};
```

---

## src/main.tsx

Wrap the app in `QueryClientProvider`. Configure `defaultOptions` globally so every
query inherits sensible defaults — no retry on 4xx errors (permanent failures should
surface immediately, not silently retry 3 times).

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { ApiError } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry on 4xx — these are permanent errors (bad request, unauthorised).
      // Do retry on network errors and 5xx (transient server issues).
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      // Don't refetch when the window regains focus — publications data is stable
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Same 4xx rule for mutations (search requests)
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

## src/App.tsx

```typescript
import React from 'react';
import { SearchBar } from './components/SearchBar';
import { PublicationList } from './components/PublicationList';
import { ProjectFilter } from './components/ProjectFilter';
import { StatusBanner } from './components/StatusBanner';
import { RecycleBinToggle } from './components/RecycleBinToggle';
import { InitialisingScreen } from './components/InitialisingScreen';
import { useServerReady } from './hooks/useServerReady';
import { usePublications } from './hooks/usePublications';
import { useSearch } from './hooks/useSearch';

export default function App() {
  const { ready, startupStage } = useServerReady();

  const {
    publications, total, totalPages,
    page, setPage, selectedProject, setSelectedProject,
    selectedCategory, setSelectedCategory, isLoading: pubsLoading, error: pubsError,
  } = usePublications();

  const {
    query, setQuery, search, results: searchResults, isLoading: searchLoading,
    error: searchError, clearSearch, includeDeleted, setIncludeDeleted,
  } = useSearch();

  const isSearchMode = searchResults !== null;
  const loading = pubsLoading || searchLoading;

  const handleSearch = useCallback((q: string) => {
    if (q.trim()) search(q, includeDeleted);
    else clearSearch();
  }, [search, clearSearch, includeDeleted]);

  const handleRecycleBinToggle = useCallback((enabled: boolean) => {
    setIncludeDeleted(enabled);
    if (query.trim()) search(query, enabled);
  }, [setIncludeDeleted, search, query]);

  // Show initialising screen until backend AI pipeline is complete
  if (!ready) return <InitialisingScreen stage={startupStage} />;

  return (
    <div className="min-h-screen bg-surface font-sans">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-900">Content Hub</span>
          </div>
          <span className="text-sm text-gray-400 font-medium tabular-nums">{total} publications</span>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-3">
          {/* onSearch is kept for Enter key / button press — sets query,
               debounce in useSearch handles the actual API call */}
          <SearchBar
            query={query}
            onChange={setQuery}
            onSearch={setQuery}
            onClear={clearSearch}
            loading={searchLoading}
          />
          <div className="flex items-center gap-3 flex-wrap">
            {searchResults && (
              <StatusBanner response={searchResults} inRecycleBin={includeDeleted} />
            )}
            {isSearchMode && (
              <RecycleBinToggle enabled={includeDeleted} onChange={setIncludeDeleted} />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">
        {!isSearchMode && (
          <aside className="w-52 shrink-0">
            {/* ProjectFilter fetches its own metadata via useFetchMeta —
                no need to pass projects/categories as props */}
            <ProjectFilter
              selectedProject={selectedProject}
              selectedCategory={selectedCategory}
              onProjectChange={setSelectedProject}
              onCategoryChange={setSelectedCategory}
              totalCount={total}
            />
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {(pubsError || searchError) && (
            <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              {pubsError ?? searchError}
            </div>
          )}
          {!isSearchMode && (
            <p className="text-sm text-gray-500 mb-4">
              {selectedProject || selectedCategory ? 'Filtered results' : 'All publications'}
              {' · '}
              <span className="font-medium text-gray-700">{total} total</span>
            </p>
          )}
          <PublicationList
            publications={isSearchMode ? undefined : publications}
            searchResults={isSearchMode ? (searchResults?.results ?? []) : undefined}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
            isSearchMode={isSearchMode}
          />
        </main>
      </div>
    </div>
  );
}
```

---

## frontend/.env.example

```
VITE_API_BASE_URL=http://localhost:3001
```
