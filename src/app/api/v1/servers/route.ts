/**
 * GET /api/v1/servers — public catalog query.
 * Params: q, kind (npm|oci|pypi|repo|remote|cmd), client, sort
 * (observed|downloads|stars|name), page, pageSize (max 100).
 */

import { type NextRequest } from "next/server";
import { browseCatalog, type CatalogSort } from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { apiJson, apiOptions } from "@/lib/apiResponse";
import type { Kind } from "@/lib/kindStyle";

export const dynamic = "force-dynamic";

const KINDS: Kind[] = ["npm", "oci", "pypi", "repo", "remote", "cmd"];
const SORTS: CatalogSort[] = ["observed", "downloads", "stars", "name"];

export function OPTIONS() {
  return apiOptions();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || undefined;
  const kind = KINDS.includes(sp.get("kind") as Kind) ? (sp.get("kind") as Kind) : undefined;
  const client = sp.get("client")?.trim() || undefined;
  const sort = (SORTS.includes(sp.get("sort") as CatalogSort) ? sp.get("sort") : "observed") as CatalogSort;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 30));

  const result = await browseCatalog({ q, kind, client, sort, page, pageSize });

  return apiJson({
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    pageCount: result.pageCount,
    servers: result.items.map((s) => ({
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
