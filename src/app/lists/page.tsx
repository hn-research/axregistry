/**
 * Category leaderboards — "what leads each space." Every MCP server is bucketed
 * into a category (derived from its name + description) and ranked by observed
 * adoption, so you can see the top servers per domain at a glance.
 */

import Link from "next/link";
import { getCategoryLeaderboards } from "@/lib/categories";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const groups = await getCategoryLeaderboards();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold text-white">Category leaderboards</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          The most-adopted MCP servers in each space, ranked by the distinct
          public repositories observed wiring them up. Categories are derived
          from each server&rsquo;s name and description.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">No data yet.</p>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g.slug} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-white">{g.label}</h2>
                <Link href={`/lists/${g.slug}`} className="shrink-0 text-xs text-indigo-300 hover:underline">
                  All {g.total} →
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">{g.blurb}</p>
              <ol className="mt-4 space-y-1.5">
                {g.servers.slice(0, 5).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <Link href={idToHref(s.id)} className="flex min-w-0 grow items-center gap-2">
                      <KindChip kind={s.kind} />
                      <span className="truncate text-zinc-200 hover:text-white hover:underline">
                        {s.displayName}
                      </span>
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {s.observedRepos > 0 ? `${s.observedRepos.toLocaleString()} repos` : "—"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-10 text-xs text-zinc-500">
        Ranked by demand-side public signal.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How this is computed
        </Link>
        .
      </footer>
    </main>
  );
}
