/**
 * GET /api/v1/lists/<slug> — one category's full ranked leaderboard.
 */

import { getCategory } from "@/lib/categories";
import { idToHref } from "@/lib/serverPath";
import { apiJson, apiError, apiOptions } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const group = await getCategory(slug);
  if (!group) return apiError("category not found", 404);

  return apiJson({
    slug: group.slug,
    label: group.label,
    blurb: group.blurb,
    total: group.total,
    servers: group.servers.map((s, i) => ({
      rank: i + 1,
      id: s.id,
      kind: s.kind,
      displayName: s.displayName,
      description: s.description,
      observedRepos: s.observedRepos,
      weeklyDownloads: s.weeklyDownloads,
      stars: s.stars,
      claimed: s.claimed,
      url: idToHref(s.id),
    })),
  });
}
