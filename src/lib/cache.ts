/**
 * Read-path caching (REGISTRY-DESIGN.md §11.2).
 *
 * The public site renders on every request, but the data behind it only moves
 * when a crawl runs (occasionally). On Neon's free plan compute — not storage —
 * is the binding constraint (100 compute-hours/month, scale-to-zero after 5 min
 * idle). So we route the hot aggregate reads through Next's data cache: a given
 * query hits Postgres at most once per `REGISTRY_TTL`, no matter how many
 * requests render it. Pages stay request-rendered (no build-time DB access), and
 * Neon autosuspends between the sparse cache-fill reads.
 *
 * Freshness is eventual by design: a TTL window, not real-time. That's the right
 * trade for a registry whose underlying data changes a few times a day at most.
 *
 * Only cache functions whose return value is JSON-safe (primitives, strings,
 * arrays, plain objects). The data cache does NOT round-trip `Date` objects — so
 * raw Drizzle rows with timestamp columns must not be cached here.
 */

import { unstable_cache } from "next/cache";

/** Shared cache tag — lets a future on-demand revalidation flush everything. */
export const REGISTRY_TAG = "registry-data";

/** Default time-to-live for cached reads (1 hour). */
export const REGISTRY_TTL = 3600;

/**
 * Skip the data cache so reads hit Postgres live. On in development (where
 * on-demand revalidation is unreliable and you're often watching ingest land),
 * or whenever REGISTRY_NO_CACHE=1. Production caches as normal.
 */
const CACHE_DISABLED =
  process.env.REGISTRY_NO_CACHE === "1" || process.env.NODE_ENV !== "production";

/**
 * Wrap a read function in the registry data cache. The cache key is the given
 * `keyParts` combined with the function's arguments, so distinct args (e.g. a
 * server id) get distinct entries automatically.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  opts: { revalidate?: number; tags?: string[] } = {},
): (...args: Args) => Promise<Result> {
  if (CACHE_DISABLED) return fn; // live reads in dev / when explicitly disabled
  return unstable_cache(fn, keyParts, {
    revalidate: opts.revalidate ?? REGISTRY_TTL,
    tags: opts.tags ?? [REGISTRY_TAG],
  });
}
