/**
 * Signed-in read layer: a user's watchlist, saved scans, and claimed servers.
 * These are per-user and low-volume (only signed-in actions hit them), so they
 * are intentionally NOT wrapped in the shared data cache.
 *
 * Ownership model for claiming: you may claim a server whose canonical GitHub
 * repo is under your account — i.e. the repo owner equals your GitHub login.
 * That is a conservative, re-checkable proof without a full verification dance.
 */

import { db } from "@/db";
import { servers, watchlist, savedScans, usages } from "@/db/schema";
import type { SavedScan } from "@/db/schema";
import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import type { Kind } from "@/lib/kindStyle";

export interface WatchedServer {
  id: string;
  kind: Kind;
  displayName: string;
  description: string | null;
  observedRepos: number;
  claimed: boolean;
  watchedAt: Date;
}

/** Servers a user follows, most-recently-added first, with live adoption. */
export async function getWatchlist(userId: string): Promise<WatchedServer[]> {
  const rows = await db
    .select({
      id: servers.id,
      kind: servers.kind,
      displayName: servers.displayName,
      description: servers.description,
      claimed: sql<boolean>`${servers.claimedBy} is not null`,
      watchedAt: watchlist.createdAt,
      observedRepos: countDistinct(usages.consumerId),
    })
    .from(watchlist)
    .innerJoin(servers, eq(servers.id, watchlist.serverId))
    .leftJoin(usages, eq(usages.serverId, servers.id))
    .where(eq(watchlist.userId, userId))
    .groupBy(servers.id, watchlist.createdAt)
    .orderBy(desc(watchlist.createdAt));
  return rows as WatchedServer[];
}

export async function isWatched(userId: string, serverId: string): Promise<boolean> {
  const [row] = await db
    .select({ x: sql`1` })
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.serverId, serverId)))
    .limit(1);
  return Boolean(row);
}

export async function getSavedScans(userId: string): Promise<SavedScan[]> {
  return db
    .select()
    .from(savedScans)
    .where(eq(savedScans.userId, userId))
    .orderBy(desc(savedScans.createdAt));
}

export interface ClaimedServer {
  id: string;
  kind: Kind;
  displayName: string;
  claimedAt: Date | null;
}

/** Servers claimed by this GitHub user (claimedBy === "github:<login>"). */
export async function getClaimedServers(githubLogin: string): Promise<ClaimedServer[]> {
  const rows = await db
    .select({
      id: servers.id,
      kind: servers.kind,
      displayName: servers.displayName,
      claimedAt: servers.claimedAt,
    })
    .from(servers)
    .where(eq(servers.claimedBy, `github:${githubLogin}`))
    .orderBy(desc(servers.claimedAt));
  return rows as ClaimedServer[];
}

// --- ownership helpers (pure, client-safe) ----------------------------------

function ownerFrom(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/github\.com\/([^/\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** The GitHub owner this server's repo belongs to, if any (from id or repoUrl). */
export function repoOwnerOf(server: { id: string; repoUrl: string | null }): string | null {
  return ownerFrom(server.id) ?? ownerFrom(server.repoUrl);
}

/** Whether a GitHub login may claim this server (repo owner === login). */
export function canClaim(
  server: { id: string; repoUrl: string | null },
  githubLogin: string | null | undefined,
): boolean {
  if (!githubLogin) return false;
  const owner = repoOwnerOf(server);
  return !!owner && owner === githubLogin.toLowerCase();
}
