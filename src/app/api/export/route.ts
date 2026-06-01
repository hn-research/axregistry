/**
 * CSV export for the reverse-lookup views. Public, read-only.
 *   /api/export?kind=repos&server=<id>   → repos using a server
 *   /api/export?kind=stack&owner=<login> → servers an owner's repos use
 *
 * Opted-out repos are never named here either (the underlying queries omit
 * them); the export is exactly what the page shows.
 */

import { type NextRequest } from "next/server";
import { reposUsingServer, orgStack } from "@/lib/reverse";
import { resolveCanonicalId } from "@/lib/queries";
import { idToHref } from "@/lib/serverPath";

export const dynamic = "force-dynamic";

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvResponse(filename: string, rows: (string | number | null)[][]): Response {
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");

  if (kind === "repos") {
    const serverParam = sp.get("server")?.trim();
    if (!serverParam) return new Response("missing ?server", { status: 400 });
    const id = await resolveCanonicalId(serverParam);
    if (!id) return new Response("unknown server", { status: 404 });
    const data = await reposUsingServer(id, 5000);
    const rows: (string | number | null)[][] = [
      ["repo", "url", "stars", "clients", "placements"],
      ...data.repos.map((r) => [
        `${r.owner}/${r.name}`,
        `https://github.com/${r.owner}/${r.name}`,
        r.stars,
        r.clients.join(" "),
        r.placements,
      ]),
    ];
    const slug = id.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    return csvResponse(`repos-using-${slug}.csv`, rows);
  }

  if (kind === "stack") {
    const owner = sp.get("owner")?.trim();
    if (!owner) return new Response("missing ?owner", { status: 400 });
    const data = await orgStack(owner, 5000);
    const rows: (string | number | null)[][] = [
      ["server", "id", "kind", "url", "repos_using"],
      ...data.servers.map((s) => [
        s.displayName,
        s.serverId,
        s.kind,
        idToHref(s.serverId),
        s.repos,
      ]),
    ];
    const slug = owner.replace(/[^a-z0-9]+/gi, "-");
    return csvResponse(`stack-${slug}.csv`, rows);
  }

  return new Response("unknown ?kind (expected 'repos' or 'stack')", { status: 400 });
}
