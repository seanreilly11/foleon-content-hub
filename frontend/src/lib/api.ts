import { z } from 'zod';
import { paginationSchema } from '../schemas';

const DEV_API_BASE_URL = 'http://localhost:3001';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEV_API_BASE_URL;

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

  // Gate 2 already threw for success: false — safe to cast to the success shape.
  // TS can't narrow through the generic envelopeSchema wrapper without a runtime branch.
  return parsed as unknown as ApiResult<z.infer<T>>;
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
