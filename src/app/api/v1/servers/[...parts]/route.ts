/**
 * GET /api/v1/servers/<id-parts> — public detail for one server, including the
 * live adoption count and the daily adoption trend. The id may be canonical or
 * an alias; we resolve it.
 */

import { getServerRecord, getServerUsage, getAdoptionHistory } from "@/lib/queries";
import { partsToId, idToHref } from "@/lib/serverPath";
import { apiJson, apiError, apiOptions } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET(_req: Request, ctx: { params: Promise<{ parts: string[] }> }) {
  const { parts } = await ctx.params;
  const id = partsToId(parts);
  if (!id) return apiError("bad server id", 400);

  const record = await getServerRecord(id);
  if (!record) return apiError("server not found", 404);

  const { server, aliases } = record;
  const [usage, history] = await Promise.all([
    getServerUsage(server.id),
    getAdoptionHistory(server.id),
  ]);

  return apiJson({
    id: server.id,
    kind: server.kind,
    displayName: server.displayName,
    description: server.description,
    homepage: server.homepage,
    repoUrl: server.repoUrl,
    latestVersion: server.latestVersion,
    license: server.license,
    weeklyDownloads: server.weeklyDownloads,
    stars: server.stars,
    hasSecurityMd: server.hasSecurityMd,
    claimed: Boolean(server.claimedBy),
    claimedBy: server.claimedBy,
    aliases,
    adoption: {
      observedRepos: usage.observedInRepos,
      totalPlacements: usage.totalPlacements,
      clients: usage.clientBreakdown,
      trend: history,
    },
    url: idToHref(server.id),
  });
}
