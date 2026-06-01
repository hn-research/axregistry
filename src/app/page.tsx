/**
 * Homepage (REGISTRY-DESIGN.md §1). A wide, Linear-scale landing: a tall hero
 * whose centerpiece is a full-width search that auto-demos itself (real server +
 * client results animate in, interactive the moment you type), followed by large
 * drill-down sections that each showcase a facet of the REGISTRY'S DATA —
 * adoption measured from real repos, the relationship graph, identity across six
 * kinds, and the credibility/badge layer.
 *
 * CRITICAL: this is NOT another directory of MCP servers (that is the official
 * MCP Registry). It is the adoption/reliability layer ON TOP of every server.
 * We differentiate by COMPOSITION — the graph, the kinds, the adoption — never
 * by a banner that name-drops a competitor.
 *
 * Trust-language rule (§10.6): observed / measured / listed — never verified /
 * safe / trusted.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import {
  getEcosystemStats,
  getEgoGraph,
  type EcosystemStats,
} from "@/lib/insights";
import { idToHref, idToParts } from "@/lib/serverPath";
import { BarList, DistributionBar, KindChip } from "@/components/Viz";
import { KIND_FILL, KIND_LABEL } from "@/lib/kindStyle";
import { OmniSearch } from "@/components/OmniSearch";
import { RelationshipGraph, type GraphData } from "@/components/RelationshipGraph";

const CONSUMER_FILL = "#10b981";

export const dynamic = "force-dynamic";

export default async function Home() {
  let stats: EcosystemStats | null = null;
  try {
    stats = await getEcosystemStats();
  } catch {
    // DB not configured yet — render the search shell regardless.
  }

  const top = stats?.topByAdoption ?? [];
  const heroServer = top[0] ?? null;

  // Live ego graph for the most-adopted server — the visual in the graph band.
  let graph: GraphData | null = null;
  if (heroServer) {
    try {
      const ego = await getEgoGraph(heroServer.id, 10, 14);
      if (ego && (ego.coServers.length > 0 || ego.consumers.length > 0)) {
        graph = {
          center: { label: ego.center.displayName, fill: KIND_FILL[ego.center.kind] },
          servers: ego.coServers.map((c) => ({
            id: c.id,
            label: c.displayName,
            kind: c.kind,
            weight: c.weight,
            fill: KIND_FILL[c.kind],
            href: idToHref(c.id),
          })),
          consumers: ego.consumers.map((c) => ({
            id: c.id,
            label: c.optedOut ? "(unlisted)" : c.label,
            kind: "consumer",
            weight: 1,
            fill: CONSUMER_FILL,
            href: c.href,
            external: true,
          })),
        };
      }
    } catch {
      /* ignore */
    }
  }

  const badgePath = heroServer
    ? `/badge/${idToParts(heroServer.id).join("/")}.svg?metric=adoption`
    : null;

  const topRows = top.slice(0, 10).map((r) => ({
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
  }));

  return (
    <main>
      {/* ═══════════════════════════ Hero ═══════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60rem 32rem at 50% -16%, rgba(129,140,248,0.22), transparent 60%), radial-gradient(40rem 28rem at 12% 8%, rgba(99,102,241,0.10), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [mask-image:radial-gradient(70rem_44rem_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="mx-auto max-w-7xl px-6 pt-28 pb-96 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Public-signal adoption data for MCP servers
          </span>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-[3.75rem] sm:leading-[1.03]">
            See which MCP servers the ecosystem actually runs.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-zinc-400">
            Search every server and client by real adoption — measured from the
            public repositories that wire them up. The reliability layer on top
            of the catalog, not another directory.
          </p>

          {/* Headline stats sit ABOVE the search so the auto-demo dropdown
              (which opens downward) never hides them. */}
          {stats && (
            <dl className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-x-14 gap-y-6">
              <Stat value={stats.totals.servers} label="servers catalogued" />
              <Stat value={stats.totals.observedServers} label="observed in real repos" />
              <Stat value={stats.totals.consumers} label="public repositories" />
              <Stat value={stats.totals.edges} label="usage edges mapped" />
            </dl>
          )}

          {/* The live, working centerpiece. The autodemo dropdown floats into
              the open space below — which is why nothing meaningful sits there. */}
          <div className="mx-auto mt-12 max-w-5xl text-left">
            <OmniSearch
              size="lg"
              autodemo
              placeholder="Try “postgres”, “cursor”, “github”…"
            />
            <p className="mt-3 text-center text-sm text-zinc-500">
              Search {stats ? stats.totals.servers.toLocaleString() : "—"} servers
              and every client observed in the wild — or{" "}
              <Link href="/scan" className="text-zinc-300 underline-offset-2 hover:underline">
                scan your own stack
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {stats ? (
        <>
          {/* ══════════ For server authors & vendors ══════════ */}
          <Section
            eyebrow="For server authors & vendors"
            title="See who's adopting you — and your competitors."
            body="Every server has a live page measured from the public repos that actually wire it up. Track your adoption, see which clients install you, claim the page to add your author band, and drop a badge in your README that stays current."
            points={[
              "Live adoption count + the repos and clients using you",
              "Claim your page: safer-mode flags, intended scopes, recommended config",
              "An embeddable badge that updates as adoption changes",
              "Watch competing servers and compare head-to-head",
            ]}
            ctaHref="/claim"
            ctaLabel="Claim your server"
            ctaSecondaryHref={heroServer ? idToHref(heroServer.id) : "/catalog"}
            ctaSecondaryLabel="See a live server page"
          >
            {badgePath && heroServer ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
                <p className="text-xs text-zinc-500">Live adoption badge — paste into any README</p>
                <div className="mt-4 flex flex-col items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={badgePath} alt="adoption badge" height={20} />
                  <code className="w-full overflow-x-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
                    [![ax-ray]({badgePath})]({idToHref(heroServer.id)})
                  </code>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Live for <strong className="text-zinc-300">{heroServer.displayName}</strong> —
                  counts public repos observed wiring it up.
                </p>
              </div>
            ) : (
              <ProofCard title="Most-adopted servers" note="distinct public repositories">
                <BarList rows={topRows} unit=" repos" />
              </ProofCard>
            )}
          </Section>

          {/* ══════════ For teams adopting MCP ══════════ */}
          <Section
            alt
            flip
            eyebrow="For teams adopting MCP"
            title="Choose a server on evidence, not vibes."
            body="Rank candidates by adoption people can verify, see what teams who run one server also wire up, and scan your own repo to inventory every MCP server it pulls in — before you ship it."
            points={[
              "Rank by repos observed, weekly downloads, and stars",
              "“Teams using X also use Y” co-occurrence signal",
              "Scan a repo or config for its full MCP footprint",
              "Save scans and revisit them as the signals move",
            ]}
            ctaHref="/scan"
            ctaLabel="Scan your stack"
            ctaSecondaryHref="/compare"
            ctaSecondaryLabel="Compare servers"
          >
            {graph ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <RelationshipGraph data={graph} />
              </div>
            ) : (
              <ProofCard title="Frequently used together" note="server pairs sharing the most repos">
                <CoOccurrenceList pairs={stats.topCoOccurrence.slice(0, 6)} />
              </ProofCard>
            )}
          </Section>

          {/* ══════════ For platform & security teams ══════════ */}
          <Section
            eyebrow="For platform & security teams"
            title="Audit your MCP supply chain."
            body="Point the scanner at any public repo and get a report on every server it wires up — resolved to one identity across all six kinds — with flags for unclaimed, stale, or missing-SECURITY.md. Observations, never verdicts; every signal is re-derivable."
            points={[
              "One canonical identity across npm, PyPI, OCI, repo, remote & cmd",
              "Flags: unclaimed · stale release · no SECURITY.md observed",
              "Every signal re-derivable from public sources",
              "Shareable, cacheable report URLs",
            ]}
            ctaHref="/scan"
            ctaLabel="Scan a repo"
            ctaSecondaryHref="/methodology"
            ctaSecondaryLabel="How it's computed"
          >
            <ProofCard title="One model across six identity kinds" note="bar width = repos observed; (n) = distinct servers">
              <DistributionBar
                slices={stats.byKind.map((k) => ({
                  key: k.kind,
                  label: `${KIND_LABEL[k.kind]} (${k.servers})`,
                  value: k.repos,
                  color: KIND_FILL[k.kind],
                }))}
              />
            </ProofCard>
          </Section>

          {/* ══════════ Market intelligence ══════════ */}
          <Section
            alt
            flip
            eyebrow="Market intelligence"
            title="Track the MCP ecosystem."
            body="The demand-side view of what the ecosystem actually runs: category leaders, the rising client landscape, and how adoption is distributed — all from public signal anyone can re-derive."
            points={[
              "Most-adopted servers and the clients driving installs",
              "Distribution across identity kinds and co-occurrence clusters",
              "Re-derivable, public-signal data — no self-reported numbers",
              "Browse the full catalog or dive into ecosystem insights",
            ]}
            ctaHref="/insights"
            ctaLabel="Open ecosystem insights"
            ctaSecondaryHref="/catalog?sort=observed"
            ctaSecondaryLabel="Browse the catalog"
          >
            <ProofCard title="Most-adopted servers" note="distinct public repositories" href="/catalog?sort=observed" hrefLabel="Full catalog →">
              <BarList rows={topRows} unit=" repos" />
            </ProofCard>
          </Section>

          <footer className="mx-auto max-w-7xl px-6 py-10 text-xs text-zinc-500">
            Demand-side signal from public GitHub configs — repos that opt out of
            listing are counted but never named. We say <em>observed</em>,{" "}
            <em>measured</em>, <em>listed</em> — never <em>verified</em> or{" "}
            <em>safe</em>.{" "}
            <Link href="/methodology" className="text-indigo-300 hover:underline">
              How this is computed
            </Link>
            . Build on it via the{" "}
            <Link href="/developers" className="text-indigo-300 hover:underline">
              public API, badges & embeds
            </Link>
            .
          </footer>
        </>
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-sm text-zinc-400">
            No data yet. Configure <code>DATABASE_URL</code>, run{" "}
            <code>npm run seed</code> and <code>npm run crawl</code> to populate
            the catalog and the demand-side usage graph.
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dd className="text-3xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
      <dt className="mt-1 text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

/**
 * A large Linear-style band built around an AUDIENCE: an outcome headline + a
 * "what you get" checklist + CTAs on one side, and a live-data proof on the
 * other. `alt` paints a faint background; `flip` puts the proof on the left.
 */
function Section({
  eyebrow,
  title,
  body,
  points,
  alt,
  flip,
  ctaHref,
  ctaLabel,
  ctaSecondaryHref,
  ctaSecondaryLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  alt?: boolean;
  flip?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  ctaSecondaryHref?: string;
  ctaSecondaryLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-b border-white/10 ${alt ? "bg-white/[0.015]" : ""}`}>
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text column */}
          <div className={flip ? "lg:order-2" : ""}>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">
              {title}
            </h2>
            <p className="mt-4 text-pretty text-lg text-zinc-400">{body}</p>
            {points && points.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {ctaHref && ctaLabel && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
                >
                  {ctaLabel}
                  <span aria-hidden>→</span>
                </Link>
                {ctaSecondaryHref && ctaSecondaryLabel && (
                  <Link
                    href={ctaSecondaryHref}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
                  >
                    {ctaSecondaryLabel}
                    <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            )}
          </div>
          {/* Proof column */}
          <div className={flip ? "lg:order-1" : ""}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

function ProofCard({
  title,
  note,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  note?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {href && hrefLabel && (
          <Link href={href} className="shrink-0 text-xs text-indigo-300 hover:underline">
            {hrefLabel}
          </Link>
        )}
      </div>
      {note && <p className="mb-4 text-xs text-zinc-500">{note}</p>}
      {children}
    </div>
  );
}

function CoOccurrenceList({
  pairs,
}: {
  pairs: { aId: string; bId: string; aName: string; bName: string; repos: number }[];
}) {
  return (
    <ul className="space-y-2.5 text-sm">
      {pairs.map((p) => (
        <li
          key={`${p.aId}|${p.bId}`}
          className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 last:border-0"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Link href={idToHref(p.aId)} className="truncate text-zinc-200 hover:text-white hover:underline">
              {p.aName}
            </Link>
            <span className="text-zinc-600">+</span>
            <Link href={idToHref(p.bId)} className="truncate text-zinc-200 hover:text-white hover:underline">
              {p.bName}
            </Link>
          </span>
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
            {p.repos.toLocaleString()} repos
          </span>
        </li>
      ))}
    </ul>
  );
}
