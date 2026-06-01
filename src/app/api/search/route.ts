/**
 * Lightweight server search for the compare typeahead. Ranked by observed
 * adoption so the most-used match surfaces first (a namesake with zero repos
 * never beats the one real repos wire up). Read-only, public.
 */

import { type NextRequest } from "next/server";
import { browseCatalog } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ items: [] });

  const { items } = await browseCatalog({ q, sort: "observed", pageSize: 8 });
  return Response.json({
    items: items.map((i) => ({
      id: i.id,
      displayName: i.displayName,
      kind: i.kind,
      observedRepos: i.observedRepos,
    })),
  });
}
