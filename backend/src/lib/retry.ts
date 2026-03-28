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
      const status =
        err !== null && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;
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
