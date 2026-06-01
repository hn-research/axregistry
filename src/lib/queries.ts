/**
 * Read-side catalog queries for the web surface. Read-mostly and cacheable
 * (§11.2). Each query returns the three bands kept distinct — callers render
 * them as separate sections, never blended (§2).
 */

import { and, count, countDistinct, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aggregates,
  authorDeclarations,
  consumers,
  serverAliases,
  servers,
  serverVersions,
  usages,
  type Aggregate,
  type AuthorDeclaration,
  type Server,
  type ServerVersion,
} from "@/db/schema";

/** Default k-anonymity floor (§5, §11.4). Server-side; raise, never lower. */
export const K_FLOOR = 5;

export interface ServerRecord {
  server: Server;
  versions: ServerVersion[];
  /** Author-declared band — present only when the page is claimed. */
  author: AuthorDeclaration | null;
  /** Community band — only when at/above the k-floor, else null (§5). */
  community: Aggregate | null;
  aliases: string[];
}

/** Resolve a canonical id OR an alias to the canonical id. */
export async function resolveCanonicalId(idOrAlias: string): Promise<string | null> {
  const direct = await db
    .select({ id: servers.id })
    .from(servers)
    .where(eq(servers.id, idOrAlias))
    .limit(1);
  if (direct[0]) return direct[0].id;

  const alias = await db
    .select({ id: serverAliases.serverId })
    .from(serverAliases)
    .where(eq(serverAliases.alias, idOrAlias))
    .limit(1);
  return alias[0]?.id ?? null;
}

export async function getServerRecord(idOrAlias: string): Promise<ServerRecord | null> {
  const id = await resolveCanonicalId(idOrAlias);
  if (!id) return null;

  const [server] = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
  if (!server) return null;

  const [versions, author, community, aliasRows] = await Promise.all([
    db
      .select()
      .from(serverVersions)
      .where(eq(serverVersions.serverId, id))
      .orderBy(desc(serverVersions.publishedAt)),
    db
      .select()
      .from(authorDeclarations)
      .where(eq(authorDeclarations.serverId, id))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(aggregates)
      .where(eq(aggregates.serverId, id))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ alias: serverAliases.alias })
      .from(serverAliases)
      .where(eq(serverAliases.serverId, id)),
  ]);

  // Enforce the k-floor at the read boundary: never hand a sub-k aggregate to
  // the view layer (§5, §10).
  const gatedCommunity =
    community && community.contributorCount >= K_FLOOR ? community : null;

  return {
    server,
    versions,
    author,
    community: gatedCommunity,
    aliases: aliasRows.map((a) => a.alias),
  };
}

export interface ServerListItem {
  id: string;
  kind: Server["kind"];
  displayName: string;
  description: string | null;
  weeklyDownloads: number | null;
  stars: number | null;
  claimed: boolean;
}

export async function listServers(limit = 60): Promise<ServerListItem[]> {
  const rows = await db
    .select()
    .from(servers)
    .orderBy(desc(sql`coalesce(${servers.weeklyDownloads}, 0)`))
    .limit(limit);
  return rows.map(toListItem);
}

export async function searchServers(q: string, limit = 40): Promise<ServerListItem[]> {
  const term = `%${q}%`;
  const rows = await db
    .select()
    .from(servers)
    .where(or(ilike(servers.displayName, term), ilike(servers.description, term)))
    .orderBy(desc(sql`coalesce(${servers.weeklyDownloads}, 0)`))
    .limit(limit);
  return rows.map(toListItem);
}

export async function countServers(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(servers);
  return row?.n ?? 0;
}

/** Distinct public repos that reference a server — the adoption-badge number. */
export async function observedRepoCount(id: string): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(usages.consumerId) })
    .from(usages)
    .where(eq(usages.serverId, id));
  return row?.n ?? 0;
}

/**
 * Demand-side usage insight for a server page (§5 insights). This is a
 * PUBLIC-data signal: every figure is re-derivable by anyone via GitHub code
 * search, so it is NOT the k-floored community band — counts are shown as-is.
 *
 * The one privacy control is display, not counting: a consumer that set
 * `listOptOut` is still counted in every aggregate, but is never named in
 * `listedConsumers` (the "aggregate + opt-out" rule).
 */
export interface UsageInsight {
  /** Distinct public repos that reference this server in a committed config. */
  observedInRepos: number;
  /** Total config placements (a repo wiring the server in two files counts twice). */
  totalPlacements: number;
  /** Which clients/hosts those configs belong to. */
  clientBreakdown: { client: string; count: number }[];
  /** Named consumer repos that did NOT opt out, most-starred first. */
  listedConsumers: { id: string; owner: string; name: string; stars: number | null }[];
  /** "Repos that use X also use Y" — co-occurrence within the same repos. */
  coOccurring: { serverId: string; displayName: string; kind: Server["kind"]; count: number }[];
}

export async function getServerUsage(id: string, namedLimit = 12): Promise<UsageInsight> {
  const [tallies, clientRows, listed, coRows] = await Promise.all([
    // Distinct repos + total placements in one pass.
    db
      .select({
        repos: countDistinct(usages.consumerId),
        placements: count(),
      })
      .from(usages)
      .where(eq(usages.serverId, id)),
    db
      .select({ client: usages.client, n: countDistinct(usages.consumerId) })
      .from(usages)
      .where(eq(usages.serverId, id))
      .groupBy(usages.client)
      .orderBy(desc(countDistinct(usages.consumerId))),
    // Named repos — opt-out suppressed at the read boundary.
    db
      .select({
        id: consumers.id,
        owner: consumers.owner,
        name: consumers.name,
        stars: consumers.stars,
      })
      .from(usages)
      .innerJoin(consumers, eq(consumers.id, usages.consumerId))
      .where(and(eq(usages.serverId, id), eq(consumers.listOptOut, false)))
      .groupBy(consumers.id, consumers.owner, consumers.name, consumers.stars)
      .orderBy(desc(sql`coalesce(${consumers.stars}, 0)`))
      .limit(namedLimit),
    // Co-occurrence: other servers referenced by the same repos.
    db
      .select({
        serverId: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        n: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .where(
        and(
          ne(usages.serverId, id),
          sql`${usages.consumerId} in (select ${usages.consumerId} from ${usages} where ${usages.serverId} = ${id})`,
        ),
      )
      .groupBy(usages.serverId, servers.displayName, servers.kind)
      .orderBy(desc(countDistinct(usages.consumerId)))
      .limit(8),
  ]);

  return {
    observedInRepos: tallies[0]?.repos ?? 0,
    totalPlacements: tallies[0]?.placements ?? 0,
    clientBreakdown: clientRows.map((r) => ({ client: r.client, count: r.n })),
    listedConsumers: listed,
    coOccurring: coRows.map((r) => ({
      serverId: r.serverId,
      displayName: r.displayName,
      kind: r.kind,
      count: r.n,
    })),
  };
}

function toListItem(s: Server): ServerListItem {
  return {
    id: s.id,
    kind: s.kind,
    displayName: s.displayName,
    description: s.description,
    weeklyDownloads: s.weeklyDownloads,
    stars: s.stars,
    claimed: s.claimedBy !== null,
  };
}
