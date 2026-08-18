/**
 * GET /badge/{serverId}.svg  (REGISTRY-DESIGN.md §7).
 *
 * The viral vector: a Shields-style SVG reflecting the server's current
 * signals. Cacheable so a popular badge costs ~nothing (§11.2). The message
 * honors the trust-language rule — never "verified"/"safe"/"trusted".
 */

import { getServerRecord, observedRepoCount, resolveCanonicalId } from "@/lib/queries";
import { partsToId } from "@/lib/serverPath";
import { renderBadge, type BadgeState } from "@/lib/badge";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ parts: string[] }> },
) {
  const { parts } = await params;
  // The final segment may carry a ".svg" suffix — strip it before resolving.
  const clean = [...parts];
  if (clean.length) clean[clean.length - 1] = clean[clean.length - 1].replace(/\.svg$/, "");

  const id = partsToId(clean);
  const metric = new URL(req.url).searchParams.get("metric");

  let state: BadgeState;
  if (metric === "adoption") {
    // The viral number, available for ANY server (claimed or not): public,
    // re-derivable demand-side adoption. Trust-language safe ("observed").
    const canonical = id ? await resolveCanonicalId(id) : null;
    const repos = canonical ? await observedRepoCount(canonical) : 0;
    state = { kind: "observed", repos };
  } else {
    const record = id ? await getServerRecord(id) : null;
    if (record?.community && record.community.contributorCount > 0) {
      state = { kind: "attested", signals: record.community.contributorCount };
    } else if (record?.server.claimedBy) {
      state = { kind: "claimed" };
    } else {
      state = { kind: "listed" };
    }
  }

  return new Response(renderBadge(state), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Cheap virality: serve from the edge for a day, revalidate in the
      // background. Badge state changes slowly, so a crawl costs ~nothing.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
