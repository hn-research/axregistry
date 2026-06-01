/**
 * Search typeahead — returns matching servers AND clients/hosts. Servers are
 * ranked by observed adoption so the most-used match surfaces first; clients by
 * how many repos commit a config for them. Read-only, public.
 */

import { type NextRequest } from "next/server";
import { browseCatalog, searchClients } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ servers: [], clients: [] });

  const [{ items }, clients] = await Promise.all([
    browseCatalog({ q, sort: "observed", pageSize: 8 }),
    searchClients(q, 5),
  ]);

  return Response.json({
    servers: items.map((i) => ({
      id: i.id,
      displayName: i.displayName,
      kind: i.kind,
      observedRepos: i.observedRepos,
    })),
    clients: clients.map((c) => ({
      client: c.client,
      repos: c.repos,
      servers: c.servers,
    })),
  });
}
