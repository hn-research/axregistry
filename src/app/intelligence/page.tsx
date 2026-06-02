/**
 * Community-observed intelligence (§5) — the section built on the opt-in ax-ray
 * signal. This is the data no one else has: what the ecosystem actually runs
 * locally, and what those servers ask for. Presence shows from the first report
 * (a marker); aggregated intelligence (which checks fire, requested permissions)
 * unlocks only at the k-anonymity floor (5+ contributors).
 */

import Link from "next/link";
import { getAxrayReportedServers, K_FLOOR } from "@/lib/intelligence";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const servers = await getAxrayReportedServers();
  const aggregated = servers.filter((s) => s.hasIntelligence);
  const emerging = servers.filter((s) => !s.hasIntelligence);
  const totalReports = servers.reduce((n, s) => n + s.reports, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="max-w-3xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Community-observed intelligence
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[2.25rem]">
          What the ecosystem actually runs — and what it asks for
        </h1>
        <p className="mt-4 text-pretty text-lg text-zinc-400">
          Opt-in, anonymized signal from people who ran{" "}
          <a href="https://www.npmjs.com/package/ax-ray" className="text-indigo-300 hover:underline">
            ax-ray
          </a>{" "}
          on their own machines. We record which servers are configured, which
          checks fire, and which permissions they request — never a value, path,
          secret, or machine id. A server&rsquo;s presence shows from the first
          report; aggregated profiles unlock at {K_FLOOR} contributors (k-anonymity).
        </p>
      </header>

      {servers.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm text-zinc-400">
            No community signal yet. Be the first — run{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-200">npx ax-ray --submit</code>{" "}
            to contribute your (anonymized) findings.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-y border-white/10 py-5">
            <Stat value={servers.length} label="servers with ax-ray signal" />
            <Stat value={totalReports} label="independent reports" />
            <Stat value={aggregated.length} label={`with full intelligence (${K_FLOOR}+)`} />
          </dl>

          {aggregated.length > 0 && (
            <Group
              title="Aggregated intelligence"
              note={`${K_FLOOR}+ independent reports — full reliability / permission profiles available on the server page.`}
              servers={aggregated}
              accent
            />
          )}
          <Group
            title="Emerging signal"
            note={`Reported by 1–${K_FLOOR - 1} contributors. Recorded and visible; detailed aggregation waits for the k-anonymity floor.`}
            servers={emerging}
          />
        </>
      )}

      <footer className="mt-12 border-t border-white/10 pt-5 text-sm text-zinc-500">
        Opt-in only, never identifying, k-floored.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How this is computed
        </Link>
        . Contribute with{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">npx ax-ray --submit</code>.
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dd className="text-2xl font-semibold tabular-nums text-white">{value.toLocaleString()}</dd>
      <dt className="mt-0.5 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

function Group({
  title,
  note,
  servers,
  accent,
}: {
  title: string;
  note: string;
  servers: { id: string; kind: import("@/lib/kindStyle").Kind; displayName: string; reports: number; hasIntelligence: boolean }[];
  accent?: boolean;
}) {
  if (servers.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-0.5 mb-4 text-sm text-zinc-500">{note}</p>
      <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
        {servers.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]">
            <Link href={idToHref(s.id)} className="flex min-w-0 items-center gap-2">
              <KindChip kind={s.kind} />
              <span className="truncate font-medium text-zinc-100">{s.displayName}</span>
            </Link>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs tabular-nums ${
                accent ? "bg-indigo-500/15 text-indigo-300" : "bg-white/10 text-zinc-400"
              }`}
            >
              ax-ray · {s.reports.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
