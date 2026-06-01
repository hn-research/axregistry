/**
 * Renders a ScanReport. Pure presentational — no client hooks — so it can be
 * server-rendered for a shareable /scan?repo=… URL and also dropped inside the
 * client form result for the pasted-config path.
 */

import Link from "next/link";
import type { ScanReport, ScanServer } from "@/lib/scan";
import { KindChip, StatCard } from "@/components/Viz";
import { KIND_FILL } from "@/lib/kindStyle";

function releaseLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 30) return "this month";
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function ServerCard({ s }: { s: ScanServer }) {
  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KindChip kind={s.kind} />
            {s.href ? (
              <Link href={s.href} className="truncate font-medium text-blue-600 hover:underline">
                {s.displayName}
              </Link>
            ) : (
              <span className="truncate font-medium">{s.displayName}</span>
            )}
            {s.claimed && (
              <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                claimed
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
            wired as “{s.inputName}” · {s.id}
          </p>
        </div>
        {s.known && (
          <div className="shrink-0 text-right text-xs text-zinc-500">
            {s.observedInRepos > 0 && <div>{s.observedInRepos.toLocaleString()} repos</div>}
            {s.stars !== null && <div>★ {s.stars.toLocaleString()}</div>}
          </div>
        )}
      </div>

      {s.known && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <Fact label="SECURITY.md" value={s.hasSecurityMd === null ? "—" : s.hasSecurityMd ? "present" : "absent"} />
          <Fact label="Latest release" value={releaseLabel(s.lastReleaseDays)} />
          <Fact label="Downloads/wk" value={s.weeklyDownloads?.toLocaleString() ?? "—"} />
          <Fact label="Transport" value={s.transport} />
        </dl>
      )}

      {s.flags.length > 0 && (
        <ul className="mt-3 space-y-1">
          {s.flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={
                  f.level === "caution"
                    ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600"
                }
                aria-hidden
              />
              <span className={f.level === "caution" ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}>
                {f.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function ScanReportView({ report }: { report: ScanReport }) {
  const cautions = report.servers.reduce(
    (n, s) => n + s.flags.filter((f) => f.level === "caution").length,
    0,
  );

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Report · <span className="font-mono text-base">{report.source}</span>
        </h2>
      </div>

      {report.notes.map((n, i) => (
        <p key={i} className="mb-3 rounded border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
          {n}
        </p>
      ))}

      {report.serverCount > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Servers wired" value={report.serverCount} />
            <StatCard label="Catalogued" value={report.knownCount} sub="we hold public signal" />
            <StatCard label="Points to review" value={cautions} sub="caution-level observations" />
          </div>

          <ul className="mt-4 space-y-3">
            {report.servers.map((s) => (
              <ServerCard key={s.id} s={s} />
            ))}
          </ul>

          {report.recommendations.length > 0 && (
            <section className="mt-8">
              <h3 className="text-sm font-semibold">Repos with a similar stack also wire up</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {report.recommendations.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: KIND_FILL[r.kind] }}
                        aria-hidden
                      />
                      <span className="truncate">{r.displayName}</span>
                      <span className="text-xs text-zinc-400">{r.repos}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-400">
                Co-occurrence across public repos — observed, not endorsed.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
