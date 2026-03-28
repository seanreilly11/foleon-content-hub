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
