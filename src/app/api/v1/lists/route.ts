/**
 * GET /api/v1/lists — category leaderboards (top servers per category).
 */

import { getCategoryLeaderboards } from "@/lib/categories";
import { idToHref } from "@/lib/serverPath";
import { apiJson, apiOptions } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  const groups = await getCategoryLeaderboards();
  return apiJson({
    categories: groups.map((g) => ({
      slug: g.slug,
      label: g.label,
      blurb: g.blurb,
      total: g.total,
      top: g.servers.slice(0, 10).map((s) => ({
        id: s.id,
        kind: s.kind,
        displayName: s.displayName,
        observedRepos: s.observedRepos,
        url: idToHref(s.id),
      })),
    })),
  });
}
