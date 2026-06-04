/**
 * Per-IP fixed-window rate limiting, backed by the existing Postgres (no
 * external limiter service). One atomic upsert per call: the window resets in
 * place when it expires, so we keep one row per (route, ip). Apply it to the
 * abuse-sensitive / uncached endpoints (ingest, export, search); CDN-cached
 * reads (/api/v1, s-maxage) are mostly served without invoking the function.
 *
 * Best-effort: if the limiter query itself errors we fail OPEN (allow the
 * request) rather than take the API down over a counter.
 */

import { sql } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

export async function rateLimit(
  req: NextRequest,
  opts: { route: string; limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const key = `${opts.route}:${clientIp(req)}`;
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({
        key,
        count: 1,
        resetAt: sql`now() + make_interval(secs => ${opts.windowSec})`,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} < now() then now() + make_interval(secs => ${opts.windowSec}) else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

    const count = row?.count ?? 1;
    const retryAfter = row?.resetAt
      ? Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - Date.now()) / 1000))
      : opts.windowSec;
    return { ok: count <= opts.limit, remaining: Math.max(0, opts.limit - count), retryAfter };
  } catch {
    return { ok: true, remaining: opts.limit, retryAfter: 0 }; // fail open
  }
}

/** Standard 429 response with Retry-After. */
export function tooMany(retryAfter: number): Response {
  return Response.json(
    { error: "rate limit exceeded", retryAfter },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}
