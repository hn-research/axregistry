/**
 * On-demand cache flush. The read path is cached for up to REGISTRY_TTL (§11.2)
 * so page views don't hammer Neon — but after an ingest (seed/crawl/enrich) we
 * want fresh counts immediately. Hitting this clears the whole registry data
 * cache so the next request re-reads Postgres once and re-fills.
 *
 *   curl -X POST "$SITE/api/revalidate" -H "x-revalidate-secret: $SECRET"
 *   curl -X POST "$SITE/api/revalidate?secret=$SECRET"
 *
 * Guarded by REVALIDATE_SECRET — refuses if the secret is unset or wrong, so it
 * can't be used to force cache-fill load anonymously.
 */

import { type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { REGISTRY_TAG } from "@/lib/cache";

export const dynamic = "force-dynamic";

function authorize(req: NextRequest): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) return false; // not configured → closed
  const provided =
    req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-revalidate-secret");
  return provided === expected;
}

function handle(req: NextRequest): Response {
  if (!authorize(req)) {
    return Response.json({ revalidated: false, error: "unauthorized" }, { status: 401 });
  }
  // Next 16: second arg is required; { expire: 0 } purges the tag immediately.
  revalidateTag(REGISTRY_TAG, { expire: 0 });
  return Response.json({ revalidated: true, tag: REGISTRY_TAG });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// GET allowed too, for a quick browser/curl flush.
export async function GET(req: NextRequest) {
  return handle(req);
}
