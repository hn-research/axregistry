/**
 * Homepage (REGISTRY-DESIGN.md §1 positioning) — a HYBRID: a confident hero and
 * feature sections that each demo a REAL feature with live data, then the live
 * ecosystem dashboard. Marketing front door and instrument in one, and honest
 * because every feature card shows the actual thing working.
 *
 * CRITICAL: this is NOT another directory of MCP servers (that is the official
 * MCP Registry). It is the credibility/reliability layer ON TOP of every
 * server, wherever it is listed. We differentiate by COMPOSITION — the graph,
 * the kinds, the adoption — never by a banner that name-drops a competitor.
 *
 * Trust-language rule (§10.6): observed / attested / listed — never verified /
 * safe / trusted.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { getEcosystemStats, type EcosystemStats } from "@/lib/insights";
import { idToHref, idToParts } from "@/lib/serverPath";
import { StatCard, BarList, DistributionBar, Panel, KindChip } from "@/components/Viz";
import { KIND_FILL, KIND_LABEL } from "@/lib/kindStyle";

export const dynamic = "force-dynamic";

export default async function Home() {
  let stats: EcosystemStats | null = null;
  try {
    stats = await getEcosystemStats();
  } catch {
    // DB not configured yet — render the positioning shell regardless.
  }

  const top = stats?.topByAdoption ?? [];
  const compareIds = top.slice(0, 3).map((s) => s.id);
  const badgeServer = top[0] ?? null;
  const badgePath = badgeServer
    ? `/badge/${idToParts(badgeServer.id).join("/")}.svg?metric=adoption`
    : null;

  return (
    <main>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(48rem 28rem at 72% -12%, rgba(129,140,248,0.22), transparent 60%), radial-gradient(40rem 26rem at 8% -4%, rgba(99,102,241,0.10), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] [mask-image:radial-gradient(60rem_40rem_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="mx-auto max-w-5xl px-6 py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            The credibility layer for MCP — built on public signal
          </span>
          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.05]">
            Know which MCP servers the ecosystem actually trusts.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-pretty text-zinc-400">
            ax-registry is the reliability signal <em>on top of</em> every MCP
            server — wherever it is published. We follow the public repos that
            wire servers up, so you can see real adoption, who uses what
            together, and what to review before you install.
          </p>

          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <Link
              href="/scan"
              className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Scan your MCP stack →
            </Link>
            <Link
              href="/insights"
              className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Explore ecosystem insights
            </Link>
          </div>

          {/* Live stat strip — proof in the hero, no scrolling required */}
          {stats && (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              <HeroStat value={stats.totals.servers} label="servers catalogued" />
              <HeroStat
                value={stats.totals.observedServers}
                label="observed in real repos"
              />
              <HeroStat value={stats.totals.consumers} label="public repositories" />
              <HeroStat value={stats.totals.edges} label="usage edges mapped" />
            </dl>
          )}
        </div>
      </section>

      {/* ─────────────────────── Feature demos ─────────────────────── */}
      {stats && (
        <div className="mx-auto max-w-5xl px-6">
          {/* 1 — Scan */}
          <Feature
            eyebrow="Audit"
            title="Scan a stack and see what to review"
            body="Paste an MCP config or point at a public repo. We resolve every server to its canonical identity and flag what's worth a look — uncatalogued, no SECURITY.md, stale releases, never-observed — as observations, never a grade."
            cta={{ href: "/scan", label: "Scan your stack →" }}
          >
            <div className="space-y-2 text-sm">
              <FlagLine tone="ok" text="filesystem · observed in 320 repos" />
              <FlagLine tone="warn" text="no SECURITY.md on the repository" />
              <FlagLine tone="warn" text="not yet observed in any public config" />
              <FlagLine tone="ok" text="3 servers your stack also commonly wires up" />
            </div>
          </Feature>

          {/* 2 — Compare (live: top-adopted servers, click through to a real set) */}
          <Feature
            flip
            eyebrow="Decide"
            title="Compare servers on signal, not vibes"
            body="Put servers side by side on the public facts we hold — adoption, stars, releases, SECURITY.md, license — and get recommendations from what similar stacks wire up. The whole comparison lives in the URL, so it's shareable."
            cta={
              compareIds.length > 0
                ? {
                    href: `/compare?ids=${encodeURIComponent(compareIds.join(","))}`,
                    label: "Compare the top servers →",
                  }
                : { href: "/compare", label: "Open compare →" }
            }
          >
            <BarList
              rows={top.slice(0, 5).map((r) => ({
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
          </Feature>

          {/* 3 — Relationship graph */}
          <Feature
            eyebrow="Map"
            title="See the graph around any server"
            body="Each server page is the center of its own ego graph: the servers it co-occurs with and the public repos that wire it up. Adoption rank tells you where it sits among everything observed in the wild."
            cta={
              badgeServer
                ? { href: idToHref(badgeServer.id), label: `Open ${badgeServer.displayName} →` }
                : { href: "/catalog", label: "Browse the catalog →" }
            }
          >
            <DistributionBar
              slices={stats.byKind.map((k) => ({
                key: k.kind,
                label: `${KIND_LABEL[k.kind]} (${k.servers})`,
                value: k.repos,
                color: KIND_FILL[k.kind],
              }))}
            />
            <p className="mt-3 text-xs text-zinc-400">
              Six identity kinds — a registry keyed only on npm would miss most of
              this.
            </p>
          </Feature>

          {/* 4 — Badges (live: the real adoption badge for the top server) */}
          <Feature
            flip
            eyebrow="Show"
            title="Embed a badge that reflects real adoption"
            body="Every server gets a live badge — claimed or not. The adoption badge shows the count of public repos observed wiring it up, re-derivable by anyone. Paste it into a README; it stays current."
            cta={{ href: badgeServer ? idToHref(badgeServer.id) : "/catalog", label: "Get a badge →" }}
          >
            {badgePath ? (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badgePath} alt="adoption badge" height={20} />
                <code className="block overflow-x-auto rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                  [![ax-ray]({badgePath})]({idToHref(badgeServer!.id)})
                </code>
                <p className="text-xs text-zinc-400">
                  Live for <strong>{badgeServer!.displayName}</strong> — updates as
                  adoption changes.
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Badges appear once data is loaded.</p>
            )}
          </Feature>
        </div>
      )}

      {/* ─────────────────── Live dashboard ─────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        {stats ? (
          <>
            <div className="mt-14 border-t border-zinc-200 pt-10 dark:border-zinc-800">
              <h2 className="text-2xl font-semibold tracking-tight">
                The ecosystem, live
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                Every figure below is demand-side signal from public GitHub
                configs — re-derivable by anyone.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Servers catalogued" value={stats.totals.servers} />
              <StatCard
                label="Observed in the wild"
                value={stats.totals.observedServers}
                sub="referenced by a real repo"
              />
              <StatCard label="Consumer repositories" value={stats.totals.consumers} />
              <StatCard
                label="Usage edges"
                value={stats.totals.edges}
                sub="config placements"
              />
            </div>

            <div className="grid gap-x-8 md:grid-cols-2">
              <Panel title="Most-adopted servers" note="by distinct public repos">
                <BarList
                  rows={stats.topByAdoption.slice(0, 8).map((r) => ({
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

              <Panel title="Client landscape" note="which agents commit these configs">
                <BarList
                  rows={stats.clientLandscape.slice(0, 8).map((c) => ({
                    key: c.client,
                    value: c.repos,
                    color: "#6366f1",
                    label: <span className="font-medium">{c.client}</span>,
                  }))}
                  unit=" repos"
                />
              </Panel>
            </div>

            <Panel title="Frequently used together" note="server pairs sharing the most repos">
              <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800/70">
                {stats.topCoOccurrence.slice(0, 8).map((p) => (
                  <li
                    key={`${p.aId}|${p.bId}`}
                    className="flex items-center justify-between gap-3 py-2"
                  >
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

            <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
              Demand-side signal from public GitHub configs — repos that opt out of
              listing are counted but never named. We say <em>observed</em>,{" "}
              <em>attested</em>, <em>listed</em> — never <em>verified</em> or{" "}
              <em>safe</em>.{" "}
              <Link href="/methodology" className="text-blue-600 hover:underline">
                How this is computed
              </Link>
              .
            </footer>
          </>
        ) : (
          <div className="mt-10 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
            No data yet. Configure <code>DATABASE_URL</code>, run{" "}
            <code>npm run seed</code> and <code>npm run crawl</code> to populate the
            catalog and the demand-side usage graph.
          </div>
        )}
      </div>
    </main>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dd className="text-3xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
      <dt className="mt-0.5 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

/**
 * One feature section: explanatory copy on one side, a live demo card on the
 * other. `flip` alternates the side on wide screens (Linear-style rhythm).
 */
function Feature({
  eyebrow,
  title,
  body,
  cta,
  flip,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: { href: string; label: string };
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="grid items-center gap-8 border-b border-zinc-100 py-14 md:grid-cols-2 dark:border-zinc-800/60">
      <div className={flip ? "md:order-2" : undefined}>
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
          {eyebrow}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">{body}</p>
        <Link
          href={cta.href}
          className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          {cta.label}
        </Link>
      </div>
      <div className={flip ? "md:order-1" : undefined}>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
          {children}
        </div>
      </div>
    </section>
  );
}

function FlagLine({ tone, text }: { tone: "ok" | "warn"; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          tone === "warn" ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />
      <span className={tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""}>
        {text}
      </span>
    </div>
  );
}
