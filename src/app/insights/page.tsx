/**
 * Ecosystem insights dashboard (REGISTRY-DESIGN.md §5.3 — BuiltWith-at-scale).
 *
 * Every figure here is computed from PUBLIC demand-side data (committed-config
 * crawl): no k-floor, re-derivable by anyone, opted-out repos counted but never
 * named. Trust-language rule (§10.6): "observed" / "listed" — never "verified".
 */

import Link from "next/link";
import { getEcosystemStats } from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { StatCard, BarList, DistributionBar, Panel, KindChip } from "@/components/Viz";
import { KIND_FILL, KIND_LABEL } from "@/lib/kindStyle";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const s = await getEcosystemStats();

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Ecosystem insights</h1>
        <p className="mt-1 text-sm text-zinc-500">
          What the MCP ecosystem actually wires up, observed across public
          repositories that committed a client config. Public data — every number
          is re-derivable; repositories that opt out of listing are counted but
          never named.
        </p>
      </header>

      {/* Headline stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Servers catalogued" value={s.totals.servers} />
        <StatCard
          label="Observed in the wild"
          value={s.totals.observedServers}
          sub="referenced by a real repo"
        />
        <StatCard label="Consumer repositories" value={s.totals.consumers} />
        <StatCard label="Usage edges" value={s.totals.edges} sub="config placements" />
      </div>

      {/* Dashboard grid — two columns on wide screens so the full width is used. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start [&>section]:mt-0">
      {/* Top adoption */}
      <Panel title="Most-adopted servers" note="by distinct public repositories">
        <BarList
          rows={s.topByAdoption.map((r) => ({
            key: r.id,
            href: idToHref(r.id),
            color: KIND_FILL[r.kind],
            value: r.repos,
            label: (
              <span className="inline-flex items-center gap-2">
                <KindChip kind={r.kind} />
                <span className="truncate">{r.displayName}</span>
              </span>
            ),
          }))}
          unit=" repos"
        />
      </Panel>

      {/* Kind distribution */}
      <Panel title="How servers are distributed" note="identity kind of referenced servers">
        <DistributionBar
          slices={s.byKind.map((k) => ({
            key: k.kind,
            label: `${KIND_LABEL[k.kind]} (${k.servers})`,
            value: k.repos,
            color: KIND_FILL[k.kind],
          }))}
        />
        <p className="mt-3 text-xs text-zinc-400">
          Bar width is by repos observed; the count in parentheses is distinct
          servers of that kind. A registry keyed only on npm would miss the
          majority — local commands, remote endpoints, PyPI and Docker servers
          all show up here.
        </p>
      </Panel>

      {/* Client landscape */}
      <Panel title="Client landscape" note="which agent clients commit these configs">
        <BarList
          rows={s.clientLandscape.map((c) => ({
            key: c.client,
            value: c.repos,
            color: "#6366f1",
            label: <span className="font-medium">{c.client}</span>,
          }))}
          unit=" repos"
        />
      </Panel>

      {/* Co-occurrence */}
      <Panel title="Frequently used together" note="server pairs sharing the most repositories">
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800/70">
          {s.topCoOccurrence.map((p) => (
            <li key={`${p.aId}|${p.bId}`} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <Link href={idToHref(p.aId)} className="truncate text-blue-600 hover:underline">
                  {p.aName}
                </Link>
                <span className="text-zinc-400">+</span>
                <Link href={idToHref(p.bId)} className="truncate text-blue-600 hover:underline">
                  {p.bName}
                </Link>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                {p.repos.toLocaleString()} repos
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      </div>

      <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Demand-side signal from public GitHub configs.{" "}
        <Link href="/methodology" className="text-blue-600 hover:underline">
          How this is computed
        </Link>
        . Browse everything in the{" "}
        <Link href="/catalog" className="text-blue-600 hover:underline">
          catalog
        </Link>
        .
      </footer>
    </main>
  );
}
