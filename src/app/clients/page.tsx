/**
 * Client landscape — the reverse view. Which MCP servers each client (Cursor,
 * Claude, VS Code, …) is configured with, ranked by the public repos observed
 * wiring them up via that client. The mirror image of the server-centric catalog.
 */

import Link from "next/link";
import { getClientLandscape } from "@/lib/clients";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const groups = await getClientLandscape();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold text-white">MCP client landscape</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          The reverse of the catalog: which MCP servers each client is configured
          with, ranked by the distinct public repositories observed wiring them
          up through that client. Derived from public configs today; ax-ray
          submissions add live on-machine usage.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">No data yet.</p>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-white">{g.label}</h2>
                <Link
                  href={`/clients/${encodeURIComponent(g.id)}`}
                  className="shrink-0 text-xs text-indigo-300 hover:underline"
                >
                  All {g.servers.toLocaleString()} →
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{g.blurb}</p>
              <p className="mt-2 text-xs tabular-nums text-zinc-400">
                <span className="text-zinc-200">{g.servers.toLocaleString()}</span> servers
                {" · "}
                <span className="text-zinc-200">{g.repos.toLocaleString()}</span> repos
              </p>
              <ol className="mt-4 space-y-1.5">
                {g.top.map((s, i) => (
                  <li key={s.serverId} className="flex items-center gap-3 text-sm">
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <Link href={idToHref(s.serverId)} className="flex min-w-0 grow items-center gap-2">
                      <KindChip kind={s.kind} />
                      <span className="truncate text-zinc-200 hover:text-white hover:underline">
                        {s.displayName}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {s.repos > 0 ? `${s.repos.toLocaleString()} repos` : "—"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-10 text-xs text-zinc-500">
        Demand-side public signal, grouped by client.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How this is computed
        </Link>
        .
      </footer>
    </main>
  );
}
