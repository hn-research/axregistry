/**
 * Per-server public page (REGISTRY-DESIGN.md §6).
 *
 * Three bands as DISTINCT sections (§2), never blended. Trust-language rule
 * (§10.6): "observed", "attested by N signals", "directory-listed" — never
 * "verified", "safe", or "trusted".
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerRecord, getServerUsage, getAdoptionHistory, K_FLOOR } from "@/lib/queries";
import { getIntelligence, type Intelligence } from "@/lib/intelligence";
import { findingLabel } from "@/lib/findingLabels";
import { getEgoGraph } from "@/lib/insights";
import { partsToId, idToHref } from "@/lib/serverPath";
import { BadgeGallery } from "@/components/BadgeGallery";
import { RelationshipGraph, type GraphData } from "@/components/RelationshipGraph";
import { WatchButton } from "@/components/WatchButton";
import { BarList, Sparkline } from "@/components/Viz";
import { KIND_FILL } from "@/lib/kindStyle";
import { auth } from "@/auth";
import { isWatched } from "@/lib/account";

const CONSUMER_FILL = "#10b981";

export const dynamic = "force-dynamic";

function relTime(d: Date | null): string {
  if (!d) return "unknown";
  const diff = Date.now() - new Date(d).getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default async function ServerPage({
  params,
}: {
  params: Promise<{ parts: string[] }>;
}) {
  const { parts } = await params;
  const id = partsToId(parts);
  if (!id) notFound();
  const record = await getServerRecord(id);
  if (!record) notFound();

  const { server, versions, author, aliases } = record;
  const [usage, ego, history, intel] = await Promise.all([
    getServerUsage(server.id),
    getEgoGraph(server.id),
    getAdoptionHistory(server.id),
    getIntelligence(server.id),
  ]);
  const trend = history.map((h) => h.repos);

  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const watched = signedIn ? await isWatched(session!.user.id, server.id) : false;
  const returnPath = idToHref(server.id);

  const graph: GraphData | null =
    ego && (ego.coServers.length > 0 || ego.consumers.length > 0)
      ? {
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
        }
      : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
            {server.kind}
          </span>
          {server.claimedBy ? (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              claimed by {server.claimedBy}
            </span>
          ) : (
            <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              unclaimed
            </span>
          )}
          {server.axrayReports > 0 && (
            <span
              className="rounded bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
              title="Independent ax-ray reports observed for this server"
            >
              ax-ray · {server.axrayReports}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="break-all text-2xl font-semibold">{server.displayName}</h1>
          <div className="shrink-0">
            <WatchButton
              serverId={server.id}
              initialWatched={watched}
              signedIn={signedIn}
              returnPath={returnPath}
            />
          </div>
        </div>
        {server.description && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{server.description}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          {server.latestVersion && <span>latest {server.latestVersion}</span>}
          {server.license && <span>{server.license}</span>}
          {server.homepage && (
            <a href={server.homepage} className="text-blue-600 hover:underline">
              homepage
            </a>
          )}
          {server.repoUrl && (
            <a href={server.repoUrl} className="text-blue-600 hover:underline">
              repository
            </a>
          )}
          <Link
            href={`/compare?ids=${encodeURIComponent(server.id)}`}
            className="text-blue-600 hover:underline"
          >
            compare
          </Link>
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-400">{server.id}</p>
      </header>

      {/* Two-column body: the observed-usage graph leads in a wide main column;
          static / author / community signals + badges sit in a sidebar. */}
      <div className="mt-8 grid gap-8 lg:grid-cols-3 lg:items-start">
      <div className="min-w-0 space-y-8 lg:col-span-2">
      {/* Observed usage — public-data signal (re-derivable via code search) */}
      <Band
        title="Observed usage"
        source="Public GitHub configs — re-verifiable by anyone"
      >
        {usage.observedInRepos > 0 ? (
          <div className="space-y-4 text-sm">
            <p>
              Observed in{" "}
              <strong>
                {usage.observedInRepos.toLocaleString()} public{" "}
                {usage.observedInRepos === 1 ? "repository" : "repositories"}
              </strong>
              {usage.totalPlacements > usage.observedInRepos && (
                <span className="text-zinc-500">
                  {" "}
                  ({usage.totalPlacements.toLocaleString()} config placements)
                </span>
              )}
              .
              {ego?.adoptionRank && ego.observedServerCount > 0 && (
                <span className="text-zinc-500">
                  {" "}
                  Ranks <strong>#{ego.adoptionRank.toLocaleString()}</strong> of{" "}
                  {ego.observedServerCount.toLocaleString()} servers observed in the wild.
                </span>
              )}{" "}
              <Link
                href={`/repos?server=${encodeURIComponent(server.id)}`}
                className="text-indigo-600 hover:underline dark:text-indigo-300"
              >
                See all repos using this →
              </Link>
            </p>

            {trend.length >= 2 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <Sparkline points={trend} />
                <div className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">Adoption trend</span>{" "}
                  · {history[0].day} → {history[history.length - 1].day}
                  {(() => {
                    const delta = trend[trend.length - 1] - trend[0];
                    if (delta === 0) return <span> · flat</span>;
                    const up = delta > 0;
                    return (
                      <span className={up ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {" "}· {up ? "+" : ""}{delta.toLocaleString()} repos
                      </span>
                    );
                  })()}
                </div>
              </div>
            )}

            {trend.length === 1 && (
              <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Adoption tracking is live</span>{" "}
                · baseline {history[0].repos.toLocaleString()} repos captured {history[0].day}. The
                trend line appears once a second daily snapshot lands.
              </div>
            )}

            {graph && (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/40 py-3 dark:border-zinc-800 dark:bg-zinc-900/20">
                <RelationshipGraph data={graph} />
              </div>
            )}

            {usage.clientBreakdown.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500">Wired via:</span>{" "}
                {usage.clientBreakdown.map((c) => (
                  <span
                    key={c.client}
                    className="mr-2 inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                  >
                    {c.client} · {c.count}
                  </span>
                ))}
              </div>
            )}

            {usage.coOccurring.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-zinc-500">
                  Repos using this also use:
                </p>
                <BarList
                  rows={usage.coOccurring.map((c) => ({
                    key: c.serverId,
                    href: idToHref(c.serverId),
                    value: c.count,
                    label: c.displayName,
                  }))}
                  unit=" shared repos"
                />
              </div>
            )}

            {usage.listedConsumers.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500">Seen in:</p>
                <ul className="mt-1 space-y-0.5">
                  {usage.listedConsumers.map((r) => (
                    <li key={r.id}>
                      <a
                        href={`https://github.com/${r.owner}/${r.name}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.owner}/{r.name}
                      </a>
                      {r.stars !== null && (
                        <span className="ml-2 text-xs text-zinc-400">
                          ★ {r.stars.toLocaleString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-zinc-400">
                  Aggregates count every public reference; repos that opt out of
                  listing are counted but not named.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Not yet observed in any crawled public config.
          </p>
        )}
      </Band>
      </div>

      {/* Sidebar — static, author, community signals + badge embed */}
      <div className="min-w-0 space-y-8">
      {/* Static-seeded */}
      <Band
        title="Static signals"
        source="Public sources — re-verifiable by anyone"
        updated={relTime(server.lastStaticRefresh)}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Fact label="Weekly downloads" value={fmtNum(server.weeklyDownloads)} />
          <Fact label="GitHub stars" value={fmtNum(server.stars)} />
          <Fact
            label="SECURITY.md"
            value={
              server.hasSecurityMd === null
                ? "—"
                : server.hasSecurityMd
                  ? "present"
                  : "absent"
            }
          />
          <Fact label="Versions" value={String(versions.length)} />
          <Fact label="Latest" value={server.latestVersion ?? "—"} />
          <Fact label="License" value={server.license ?? "—"} />
        </dl>
        {aliases.length > 0 && (
          <p className="mt-4 text-xs text-zinc-500">
            Also known as:{" "}
            {aliases.map((a) => (
              <code key={a} className="mr-2 break-all">
                {a}
              </code>
            ))}
          </p>
        )}
      </Band>

      {/* Band 2 — Author-declared */}
      <Band
        title="Author-declared"
        source={author ? "Declared by the verified author" : "Not yet claimed"}
        updated={author ? relTime(author.updatedAt) : undefined}
      >
        {author ? (
          <div className="space-y-2 text-sm">
            {author.notes && <p>{author.notes}</p>}
            <JsonFact label="Safer-mode flags" value={author.saferModeFlags} />
            <JsonFact label="Intended scopes" value={author.intendedScopes} />
            <JsonFact label="Recommended config" value={author.recommendedConfig} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            No author context yet.{" "}
            <Link
              href={`/claim?server=${encodeURIComponent(server.id)}`}
              className="text-blue-600 hover:underline"
            >
              Are you the author? Claim this page.
            </Link>
          </p>
        )}
      </Band>

      {/* Band 3 — Community-observed (ax-ray) */}
      <Band
        title="Community-observed"
        source="Opt-in, anonymized signal from people who ran ax-ray"
      >
        {intel ? (
          <CommunityIntel intel={intel} />
        ) : server.axrayReports > 0 ? (
          <p className="text-sm text-zinc-500">
            Observed by{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              {server.axrayReports}
            </strong>{" "}
            independent ax-ray report{server.axrayReports === 1 ? "" : "s"}.
            Aggregated intelligence unlocks at {K_FLOOR} contributors (k-anonymity
            floor).
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Not enough signal yet — no community aggregate is shown below{" "}
            {K_FLOOR} contributors (k-anonymity floor). Run{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              npx ax-ray --submit
            </code>{" "}
            to contribute.
          </p>
        )}
      </Band>

      {/* Badges — offered for every server; the adoption number is the viral hook */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Embed a badge
          </h2>
          {!server.claimedBy && (
            <Link
              href={`/claim?server=${encodeURIComponent(server.id)}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Are you the author? Claim this page →
            </Link>
          )}
        </div>
        <BadgeGallery id={server.id} />
      </section>
      </div>
      </div>

      <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Every signal links to how it is computed.{" "}
        <Link href="/methodology" className="text-blue-600 hover:underline">
          Methodology
        </Link>
        . Static is a snapshot; community is a heartbeat.
      </footer>
    </main>
  );
}

function CommunityIntel({ intel }: { intel: Intelligence }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-700 dark:text-zinc-300">
        Attested by <strong>{intel.contributorCount}</strong> independent signals.
      </p>
      {intel.findings.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-zinc-500">Findings observed (share of reports)</p>
          <ul className="space-y-1">
            {intel.findings.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs">
                  <span className="font-mono text-[10px] text-zinc-500">{f.id}</span>{" "}
                  {findingLabel(f.id)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {Math.round(f.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {intel.envKeys.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-zinc-500">Commonly requested env keys</p>
          <div className="flex flex-wrap gap-1">
            {intel.envKeys.slice(0, 8).map((e) => (
              <span
                key={e.key}
                className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800"
              >
                {e.key}
              </span>
            ))}
          </div>
        </div>
      )}
      {intel.transports.length > 0 && (
        <p className="text-xs text-zinc-500">
          Transport: {intel.transports.map((t) => `${t.transport} ×${t.count}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Band({
  title,
  source,
  updated,
  children,
}: {
  title: string;
  source: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="mt-0.5 block text-xs text-zinc-400">
          {source}
          {updated ? ` · updated ${updated}` : ""}
        </span>
      </div>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {children}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function JsonFact({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <span className="text-xs text-zinc-500">{label}:</span>{" "}
      <code className="text-xs">{JSON.stringify(value)}</code>
    </div>
  );
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}
