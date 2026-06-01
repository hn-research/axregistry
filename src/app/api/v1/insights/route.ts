/**
 * GET /api/v1/insights — ecosystem totals and the headline rankings that power
 * the insights dashboard.
 */

import { getEcosystemStats } from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { apiJson, apiOptions } from "@/lib/apiResponse";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return apiOptions();
}

export async function GET() {
  const s = await getEcosystemStats();
  return apiJson({
    totals: s.totals,
    topByAdoption: s.topByAdoption.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      kind: r.kind,
      observedRepos: r.repos,
      url: idToHref(r.id),
    })),
    byKind: s.byKind,
    clientLandscape: s.clientLandscape,
    topCoOccurrence: s.topCoOccurrence,
  });
}
