/**
 * Writes for demand-side discovery: upsert the consumer repo, ensure the
 * referenced server exists (a minimal "listed" stub if we haven't seen it via
 * a static source yet), and record the usage edge. All through the §11.1
 * identity resolver, so a server found via a config and via npm collapse into
 * one canonical row.
 */

import { db } from "../db";
import { consumers, servers, usages } from "../db/schema";
import { repoId, type CanonicalId } from "./identity";

/** Human display name from a canonical id (strip the "kind:" prefix). */
export function displayNameForId(id: CanonicalId): string {
  return id.id.slice(id.id.indexOf(":") + 1);
}

export async function ensureConsumer(
  owner: string,
  repo: string,
  stars?: number,
): Promise<string | null> {
  const rid = repoId(`github.com/${owner}/${repo}`);
  if (!rid) return null;
  const now = new Date();
  await db
    .insert(consumers)
    .values({
      id: rid.id,
      host: "github.com",
      owner,
      name: repo,
      stars: stars ?? null,
      lastCrawledAt: now,
    })
    .onConflictDoUpdate({
      target: consumers.id,
      set: { stars: stars ?? null, lastCrawledAt: now },
    });
  return rid.id;
}

/** Create a minimal "listed" server row if it doesn't exist yet. */
export async function ensureServerStub(canonical: CanonicalId): Promise<void> {
  await db
    .insert(servers)
    .values({
      id: canonical.id,
      kind: canonical.kind,
      displayName: displayNameForId(canonical),
    })
    .onConflictDoNothing();
}

/** Batch-create "listed" server stubs for many canonical ids in one round-trip. */
export async function ensureServerStubs(canon: CanonicalId[]): Promise<void> {
  if (canon.length === 0) return;
  const uniq = new Map<string, CanonicalId>();
  for (const c of canon) uniq.set(c.id, c);
  await db
    .insert(servers)
    .values(
      [...uniq.values()].map((c) => ({
        id: c.id,
        kind: c.kind,
        displayName: displayNameForId(c),
      })),
    )
    .onConflictDoNothing();
}

export interface UsageRow {
  consumerId: string;
  server: CanonicalId;
  configPath: string;
  client: string;
  transport?: string;
  envKeys: string[];
}

/**
 * Record many usage edges in a single insert. Compute-frugal: one DB round-trip
 * for the stubs and one for the edges, so a paced background crawl touches the
 * DB rarely and Neon can autosuspend through the rate-limit sleeps.
 */
export async function recordUsagesBatch(rows: UsageRow[]): Promise<void> {
  if (rows.length === 0) return;
  await ensureServerStubs(rows.map((r) => r.server));
  await db
    .insert(usages)
    .values(
      rows.map((r) => ({
        consumerId: r.consumerId,
        serverId: r.server.id,
        configPath: r.configPath,
        client: r.client,
        transport: r.transport ?? null,
        envKeys: r.envKeys,
      })),
    )
    .onConflictDoNothing();
}

export async function recordUsage(args: {
  consumerId: string;
  server: CanonicalId;
  configPath: string;
  client: string;
  transport?: string;
  envKeys: string[];
}): Promise<void> {
  await ensureServerStub(args.server);
  await db
    .insert(usages)
    .values({
      consumerId: args.consumerId,
      serverId: args.server.id,
      configPath: args.configPath,
      client: args.client,
      transport: args.transport ?? null,
      envKeys: args.envKeys,
    })
    .onConflictDoNothing();
}
