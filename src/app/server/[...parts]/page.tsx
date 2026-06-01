/**
 * Per-server public page (REGISTRY-DESIGN.md §6).
 *
 * Three bands as DISTINCT sections (§2), never blended. Trust-language rule
 * (§10.6): "observed", "attested by N signals", "directory-listed" — never
 * "verified", "safe", or "trusted".
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerRecord, getServerUsage, K_FLOOR } from "@/lib/queries";
import { getEgoGraph } from "@/lib/insights";
import { partsToId, idToHref } from "@/lib/serverPath";
import { BadgeGallery } from "@/components/BadgeGallery";
import { RelationshipGraph, type GraphData } from "@/components/RelationshipGraph";
import { BarList } from "@/components/Viz";
import { KIND_FILL } from "@/lib/kindStyle";

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

  const { server, versions, author, community, aliases } = record;
  const [usage, ego] = await Promise.all([
    getServerUsage(server.id),
    getEgoGraph(server.id),
  ]);

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
    <main className="mx-auto max-w-4xl px-6 py-10">
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
        </div>
        <h1 className="mt-3 break-all text-2xl font-semibold">{server.displayName}</h1>
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

      {/* Band 1 — Static-seeded */}
      <Band
        title="Static signals"
        source="Public sources — re-verifiable by anyone"
        updated={relTime(server.lastStaticRefresh)}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
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
              )}
            </p>

            {graph && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 py-3 dark:border-zinc-800 dark:bg-zinc-900/20">
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

      {/* Band 3 — Community-observed */}
      <Band
        title="Community-observed"
        source="Opt-in, anonymized signal from people who ran ax-ray"
        updated={community ? relTime(community.lastComputedAt) : undefined}
      >
        {community ? (
          <p className="text-sm">
            Attested by {community.contributorCount} signals.
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Not enough signal yet — no community aggregate is shown below{" "}
            {K_FLOOR} contributors (k-anonymity floor). Opens in v2.
          </p>
        )}
      </Band>

      {/* Badges — offered for every server; the adoption number is the viral hook */}
      <section className="mt-8">
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
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-zinc-400">
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
