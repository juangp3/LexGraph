export const MIN_GRAPH_DEPTH = 1;
export const MAX_GRAPH_DEPTH = 8;
export const DEFAULT_GRAPH_DEPTH = 3;

export function normalizeGraphDepth(value: unknown, fallback = DEFAULT_GRAPH_DEPTH): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  const truncated = Math.trunc(value);
  return Math.max(MIN_GRAPH_DEPTH, Math.min(MAX_GRAPH_DEPTH, truncated));
}
