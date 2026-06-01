/**
 * Insight queries — the BuiltWith-style cross-sectional aggregations over the
 * demand-side usage graph (REGISTRY-DESIGN.md §5.3). All read-mostly and
 * cacheable (§11.2).
 *
 * These are computed from PUBLIC demand-side data (committed-config crawl), so
 * counts carry no k-floor — every figure is re-derivable by anyone via code
 * search. The only privacy control is display: a consumer repo with
 * `listOptOut` is counted in every aggregate but never named (§10.7).
 *
 * Trust-language rule (§10.6): "observed" / "listed" — never "verified" /
 * "trusted" / "safe".
 */

import { and, asc, count, countDistinct, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cached } from "@/lib/cache";
import { consumers, servers, serverVersions, usages, type Server } from "@/db/schema";

export type ServerKindCol = Server["kind"];

/** A ranked entry for a BarList. */
export interface RankedServer {
  id: string;
  displayName: string;
  kind: ServerKindCol;
  repos: number;
}

export interface KindRow {
  kind: ServerKindCol;
  servers: number;
  repos: number;
}

export interface ClientRow {
  client: string;
  repos: number;
  edges: number;
}

export interface CoOccurrencePair {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  repos: number;
}

export interface EcosystemStats {
  totals: { servers: number; observedServers: number; consumers: number; edges: number };
  topByAdoption: RankedServer[];
  byKind: KindRow[];
  clientLandscape: ClientRow[];
  topCoOccurrence: CoOccurrencePair[];
}

/** The whole ecosystem dashboard in one round of parallel queries. */
async function _getEcosystemStats(): Promise<EcosystemStats> {
  const [totalsRow, observedRow, topByAdoption, byKind, clientLandscape, coPairs] =
    await Promise.all([
      db
        .select({
          servers: sql<number>`(select count(*)::int from ${servers})`,
          consumers: sql<number>`(select count(*)::int from ${consumers})`,
          edges: sql<number>`(select count(*)::int from ${usages})`,
        })
        .from(sql`(select 1) as _`)
        .then((r) => r[0]),
      db
        .select({ n: countDistinct(usages.serverId) })
        .from(usages)
        .then((r) => r[0]?.n ?? 0),
      db
        .select({
          id: servers.id,
          displayName: servers.displayName,
          kind: servers.kind,
          repos: countDistinct(usages.consumerId),
        })
        .from(usages)
        .innerJoin(servers, eq(servers.id, usages.serverId))
        .groupBy(servers.id, servers.displayName, servers.kind)
        .orderBy(desc(countDistinct(usages.consumerId)))
        .limit(20),
      db
        .select({
          kind: servers.kind,
          servers: countDistinct(servers.id),
          repos: countDistinct(usages.consumerId),
        })
        .from(usages)
        .innerJoin(servers, eq(servers.id, usages.serverId))
        .groupBy(servers.kind)
        .orderBy(desc(countDistinct(usages.consumerId))),
      db
        .select({
          client: usages.client,
          repos: countDistinct(usages.consumerId),
          edges: count(),
        })
        .from(usages)
        .groupBy(usages.client)
        .orderBy(desc(countDistinct(usages.consumerId))),
      topCoOccurrencePairs(15),
    ]);

  return {
    totals: {
      servers: totalsRow?.servers ?? 0,
      observedServers: observedRow,
      consumers: totalsRow?.consumers ?? 0,
      edges: totalsRow?.edges ?? 0,
    },
    topByAdoption,
    byKind,
    clientLandscape,
    topCoOccurrence: coPairs,
  };
}
export const getEcosystemStats = cached(_getEcosystemStats, ["getEcosystemStats"]);

/**
 * Global co-occurrence: unordered server pairs that appear in the same
 * consumer repo, ranked by how many repos share both. Self-join on the usage
 * edge, deduped to a<b so each pair appears once.
 */
async function topCoOccurrencePairs(limit: number): Promise<CoOccurrencePair[]> {
  const a = sql`u1`;
  const b = sql`u2`;
  const rows = await db.execute(sql`
    select
      ${a}.server_id as a_id, sa.display_name as a_name,
      ${b}.server_id as b_id, sb.display_name as b_name,
      count(distinct ${a}.consumer_id)::int as repos
    from ${usages} as ${a}
    join ${usages} as ${b}
      on ${a}.consumer_id = ${b}.consumer_id and ${a}.server_id < ${b}.server_id
    join ${servers} sa on sa.id = ${a}.server_id
    join ${servers} sb on sb.id = ${b}.server_id
    group by ${a}.server_id, sa.display_name, ${b}.server_id, sb.display_name
    having count(distinct ${a}.consumer_id) > 1
    order by repos desc
    limit ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    aId: String(r.a_id),
    aName: String(r.a_name),
    bId: String(r.b_id),
    bName: String(r.b_name),
    repos: Number(r.repos),
  }));
}

// --- Full catalog browse ---------------------------------------------------

export type CatalogSort = "downloads" | "stars" | "observed" | "name";

export interface CatalogItem {
  id: string;
  kind: ServerKindCol;
  displayName: string;
  description: string | null;
  weeklyDownloads: number | null;
  stars: number | null;
  observedRepos: number;
  claimed: boolean;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CatalogQuery {
  q?: string;
  kind?: ServerKindCol;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}

/**
 * Paginated, filterable, sortable catalog. Observed-repo counts come from a
 * correlated subquery so servers with zero usage still appear (left of the
 * usage graph), and the catalog can be sorted by adoption.
 */
async function _browseCatalog(opts: CatalogQuery = {}): Promise<CatalogPage> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 30));
  const sort: CatalogSort = opts.sort ?? "observed";

  const filters = [];
  if (opts.q) {
    const term = `%${opts.q}%`;
    filters.push(or(ilike(servers.displayName, term), ilike(servers.description, term)));
  }
  if (opts.kind) filters.push(eq(servers.kind, opts.kind));
  const where = filters.length ? and(...filters) : undefined;

  const observed = sql<number>`(
    select count(distinct ${usages.consumerId})::int
    from ${usages} where ${usages.serverId} = ${servers.id}
  )`;

  const orderBy = (() => {
    switch (sort) {
      case "downloads":
        return desc(sql`coalesce(${servers.weeklyDownloads}, 0)`);
      case "stars":
        return desc(sql`coalesce(${servers.stars}, 0)`);
      case "name":
        return asc(servers.displayName);
      case "observed":
      default:
        return desc(observed);
    }
  })();

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: servers.id,
        kind: servers.kind,
        displayName: servers.displayName,
        description: servers.description,
        weeklyDownloads: servers.weeklyDownloads,
        stars: servers.stars,
        observedRepos: observed,
        claimedBy: servers.claimedBy,
      })
      .from(servers)
      .where(where)
      .orderBy(orderBy, asc(servers.displayName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(servers)
      .where(where)
      .then((r) => r[0]?.n ?? 0),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      displayName: r.displayName,
      description: r.description,
      weeklyDownloads: r.weeklyDownloads,
      stars: r.stars,
      observedRepos: r.observedRepos,
      claimed: r.claimedBy !== null,
    })),
    total: totalRow,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(totalRow / pageSize)),
  };
}
export const browseCatalog = cached(_browseCatalog, ["browseCatalog"]);

// --- Stack recommendation (shared by /scan and /compare) -------------------

export interface StackRecommendation {
  id: string;
  displayName: string;
  kind: ServerKindCol;
  repos: number;
}

/** Parenthesized SQL list for `in (...)` / `not in (...)`. */
function sqlInList(ids: string[]) {
  return sql`(${sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `,
  )})`;
}

/**
 * "Repos like yours also wire up Y": servers most co-occurring with ANY server
 * in `stackIds`, excluding the stack itself. One self-join on the usage graph.
 * Naming a server, not a consumer repo, so opt-out is irrelevant here.
 */
async function _recommendForStack(
  stackIds: string[],
  limit = 6,
): Promise<StackRecommendation[]> {
  if (stackIds.length === 0) return [];
  const rows = await db.execute(sql`
    select u2.server_id as id, s.display_name as name, s.kind as kind,
           count(distinct u2.consumer_id)::int as repos
    from ${usages} u1
    join ${usages} u2 on u1.consumer_id = u2.consumer_id
    join ${servers} s on s.id = u2.server_id
    where u1.server_id in ${sqlInList(stackIds)}
      and u2.server_id not in ${sqlInList(stackIds)}
    group by u2.server_id, s.display_name, s.kind
    order by repos desc
    limit ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    displayName: String(r.name),
    kind: String(r.kind) as ServerKindCol,
    repos: Number(r.repos),
  }));
}
export const recommendForStack = cached(_recommendForStack, ["recommendForStack"]);

// --- Side-by-side comparison -----------------------------------------------

export interface ComparedServer {
  id: string;
  displayName: string;
  kind: ServerKindCol;
  description: string | null;
  claimed: boolean;
  stars: number | null;
  weeklyDownloads: number | null;
  latestVersion: string | null;
  license: string | null;
  homepage: string | null;
  repoUrl: string | null;
  hasSecurityMd: boolean | null;
  lastReleaseDays: number | null;
  observedInRepos: number;
  adoptionRank: number | null;
}

/**
 * Fetch a comparison set in id order. Adoption rank is computed once over the
 * whole usage graph (a single window) and filtered to the requested ids.
 */
async function _getComparison(ids: string[]): Promise<ComparedServer[]> {
  if (ids.length === 0) return [];

  const [serverRows, releaseRows, rankRows] = await Promise.all([
    db.select().from(servers).where(inArray(servers.id, ids)),
    db
      .select({
        serverId: serverVersions.serverId,
        last: sql<string | null>`max(${serverVersions.publishedAt})`,
      })
      .from(serverVersions)
      .where(inArray(serverVersions.serverId, ids))
      .groupBy(serverVersions.serverId),
    db.execute(sql`
      with ranked as (
        select server_id, count(distinct consumer_id)::int as repos,
               rank() over (order by count(distinct consumer_id) desc)::int as rnk
        from ${usages} group by server_id
      )
      select server_id, repos, rnk from ranked where server_id in ${sqlInList(ids)}
    `),
  ]);

  const byId = new Map(serverRows.map((s) => [s.id, s]));
  const lastById = new Map(releaseRows.map((r) => [r.serverId, r.last]));
  const rankById = new Map(
    (rankRows.rows as Record<string, unknown>[]).map((r) => [
      String(r.server_id),
      { repos: Number(r.repos), rnk: Number(r.rnk) },
    ]),
  );
  const DAY = 86_400_000;

  // Preserve caller order; drop ids that don't resolve to a server.
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is Server => Boolean(s))
    .map((s) => {
      const last = lastById.get(s.id) ?? null;
      const rank = rankById.get(s.id);
      return {
        id: s.id,
        displayName: s.displayName,
        kind: s.kind,
        description: s.description,
        claimed: s.claimedBy != null,
        stars: s.stars,
        weeklyDownloads: s.weeklyDownloads,
        latestVersion: s.latestVersion,
        license: s.license,
        homepage: s.homepage,
        repoUrl: s.repoUrl,
        hasSecurityMd: s.hasSecurityMd,
        lastReleaseDays:
          last !== null ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null,
        observedInRepos: rank?.repos ?? 0,
        adoptionRank: rank?.rnk ?? null,
      };
    });
}
export const getComparison = cached(_getComparison, ["getComparison"]);

// --- Per-server ego graph --------------------------------------------------

export interface GraphServerNode {
  id: string;
  displayName: string;
  kind: ServerKindCol;
  weight: number; // shared repos
}

export interface GraphConsumerNode {
  id: string;
  label: string; // owner/name
  href: string | null; // null when opted out of listing
  stars: number | null;
  optedOut: boolean;
}

export interface EgoGraph {
  center: { id: string; displayName: string; kind: ServerKindCol };
  /** Adoption: distinct repos referencing the center server. */
  observedInRepos: number;
  /** Rank of this server among all observed servers (1 = most adopted). */
  adoptionRank: number | null;
  observedServerCount: number;
  coServers: GraphServerNode[];
  consumers: GraphConsumerNode[];
}

/**
 * Build the ego graph for a server: the center node, the servers it co-occurs
 * with (weighted by shared repos), and the consumer repos that reference it.
 * Opt-out is honored on the consumer label/href, never on the count.
 */
async function _getEgoGraph(
  id: string,
  coLimit = 12,
  consumerLimit = 18,
): Promise<EgoGraph | null> {
  const [center] = await db
    .select({ id: servers.id, displayName: servers.displayName, kind: servers.kind })
    .from(servers)
    .where(eq(servers.id, id))
    .limit(1);
  if (!center) return null;

  const [observedRow, rankRows, coServers, consumerRows] = await Promise.all([
    db
      .select({ n: countDistinct(usages.consumerId) })
      .from(usages)
      .where(eq(usages.serverId, id))
      .then((r) => r[0]?.n ?? 0),
    // Adoption ranking across all observed servers.
    db.execute(sql`
      with ranked as (
        select server_id, count(distinct consumer_id) as repos,
               rank() over (order by count(distinct consumer_id) desc) as rnk
        from ${usages} group by server_id
      )
      select rnk::int as rnk, (select count(*)::int from ranked) as total
      from ranked where server_id = ${id}
    `),
    db
      .select({
        id: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        weight: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .where(
        and(
          sql`${usages.serverId} <> ${id}`,
          sql`${usages.consumerId} in (select consumer_id from ${usages} where server_id = ${id})`,
        ),
      )
      .groupBy(usages.serverId, servers.displayName, servers.kind)
      .orderBy(desc(countDistinct(usages.consumerId)))
      .limit(coLimit),
    db
      .select({
        id: consumers.id,
        owner: consumers.owner,
        name: consumers.name,
        stars: consumers.stars,
        optedOut: consumers.listOptOut,
      })
      .from(usages)
      .innerJoin(consumers, eq(consumers.id, usages.consumerId))
      .where(eq(usages.serverId, id))
      .groupBy(consumers.id, consumers.owner, consumers.name, consumers.stars, consumers.listOptOut)
      .orderBy(desc(sql`coalesce(${consumers.stars}, 0)`))
      .limit(consumerLimit),
  ]);

  const rankRow = (rankRows.rows as Record<string, unknown>[])[0];

  return {
    center,
    observedInRepos: observedRow,
    adoptionRank: rankRow ? Number(rankRow.rnk) : null,
    observedServerCount: rankRow ? Number(rankRow.total) : 0,
    coServers: coServers.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      kind: c.kind,
      weight: c.weight,
    })),
    consumers: consumerRows.map((c) => ({
      id: c.id,
      label: `${c.owner}/${c.name}`,
      href: c.optedOut ? null : `https://github.com/${c.owner}/${c.name}`,
      stars: c.stars,
      optedOut: c.optedOut,
    })),
  };
}
export const getEgoGraph = cached(_getEgoGraph, ["getEgoGraph"]);
