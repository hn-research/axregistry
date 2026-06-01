/**
 * Reverse lookups — the BuiltWith-style "who uses what" views, both directions:
 *
 *   • reposUsingServer(id)  → every public repo that wires up a server
 *   • orgStack(owner)       → every server a GitHub owner's repos wire up
 *
 * Public demand-side signal, re-derivable via code search. Privacy rule (§10):
 * repos that set `listOptOut` are still COUNTED in totals but never NAMED — so
 * the named list omits them and we surface the hidden count instead.
 */

import { db } from "@/db";
import { servers, consumers, usages } from "@/db/schema";
import type { Server } from "@/db/schema";
import { and, count, countDistinct, desc, eq, ilike, sql } from "drizzle-orm";
import { cached } from "@/lib/cache";

export interface ConsumerRow {
  id: string;
  owner: string;
  name: string;
  stars: number | null;
  clients: string[];
  placements: number;
}

export interface ReposUsingServer {
  /** Named (non-opted-out) repos, most-starred first, capped at `limit`. */
  repos: ConsumerRow[];
  /** Distinct repos total, including opted-out (counted, not named). */
  total: number;
  /** Distinct named (non-opted-out) repos total. */
  named: number;
  /** Opted-out repos: counted in `total`, never listed. */
  hidden: number;
}

async function _reposUsingServer(id: string, limit = 500): Promise<ReposUsingServer> {
  const [rows, totalRow, namedRow] = await Promise.all([
    db
      .select({
        id: consumers.id,
        owner: consumers.owner,
        name: consumers.name,
        stars: consumers.stars,
        clients: sql<string | null>`string_agg(distinct ${usages.client}, ',')`,
        placements: count(),
      })
      .from(usages)
      .innerJoin(consumers, eq(consumers.id, usages.consumerId))
      .where(and(eq(usages.serverId, id), eq(consumers.listOptOut, false)))
      .groupBy(consumers.id, consumers.owner, consumers.name, consumers.stars)
      .orderBy(desc(sql`coalesce(${consumers.stars}, 0)`))
      .limit(limit),
    db.select({ n: countDistinct(usages.consumerId) }).from(usages).where(eq(usages.serverId, id)),
    db
      .select({ n: countDistinct(usages.consumerId) })
      .from(usages)
      .innerJoin(consumers, eq(consumers.id, usages.consumerId))
      .where(and(eq(usages.serverId, id), eq(consumers.listOptOut, false))),
  ]);

  const total = totalRow[0]?.n ?? 0;
  const named = namedRow[0]?.n ?? 0;
  return {
    repos: rows.map((r) => ({
      id: r.id,
      owner: r.owner,
      name: r.name,
      stars: r.stars,
      clients: r.clients ? r.clients.split(",").filter(Boolean) : [],
      placements: r.placements,
    })),
    total,
    named,
    hidden: Math.max(0, total - named),
  };
}
export const reposUsingServer = cached(_reposUsingServer, ["reposUsingServer"]);

export interface OrgServerRow {
  serverId: string;
  displayName: string;
  kind: Server["kind"];
  repos: number;
}

export interface OrgStack {
  owner: string;
  /** Distinct repos owned by this owner that wire up any server. */
  repoCount: number;
  servers: OrgServerRow[];
}

async function _orgStack(owner: string, limit = 500): Promise<OrgStack> {
  const [rows, repoRow] = await Promise.all([
    db
      .select({
        serverId: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        repos: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(consumers, eq(consumers.id, usages.consumerId))
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .where(ilike(consumers.owner, owner))
      .groupBy(usages.serverId, servers.displayName, servers.kind)
      .orderBy(desc(countDistinct(usages.consumerId)))
      .limit(limit),
    db
      .select({ n: countDistinct(consumers.id) })
      .from(consumers)
      .where(ilike(consumers.owner, owner)),
  ]);

  return {
    owner,
    repoCount: repoRow[0]?.n ?? 0,
    servers: rows.map((r) => ({
      serverId: r.serverId,
      displayName: r.displayName,
      kind: r.kind,
      repos: r.repos,
    })),
  };
}
export const orgStack = cached(_orgStack, ["orgStack"]);
