/**
 * Ingestion control plane (DB-driven). The controller (`scripts/ingest.ts`)
 * reads its knobs from `ingest_config` instead of env flags, logs each run to
 * `ingest_runs` with before/after catalog counts, and so a single trigger
 * (`npm run ingest`) self-configures and reports what changed since last time.
 */

import { randomUUID } from "node:crypto";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { ingestConfig, ingestRuns } from "@/db/schema";

export interface IngestSettings {
  runSeed: boolean;
  runCrawl: boolean;
  runEnrich: boolean;
  runSnapshot: boolean;
  // seed
  seedMaxPerQuery: number;
  seedPypiPages: number;
  seedGithubPages: number;
  // crawl
  crawlMaxPages: number;
  // enrich
  enrichLimit: number;
}

export const DEFAULT_SETTINGS: IngestSettings = {
  runSeed: true,
  runCrawl: true,
  runEnrich: true,
  runSnapshot: true,
  seedMaxPerQuery: 1000,
  seedPypiPages: 30,
  seedGithubPages: 10,
  crawlMaxPages: 10,
  enrichLimit: 1000,
};

/** Load settings from the DB, seeding any missing key with its default. */
export async function loadSettings(): Promise<IngestSettings> {
  const rows = await db.select().from(ingestConfig);
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  const missing: { key: string; value: unknown }[] = [];
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored.has(key)) out[key] = stored.get(key);
    else missing.push({ key, value: def });
  }
  if (missing.length) await db.insert(ingestConfig).values(missing).onConflictDoNothing();
  return out as unknown as IngestSettings;
}

/** Set one config key (used by `npm run ingest -- set <key> <value>`). */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(ingestConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: ingestConfig.key, set: { value, updatedAt: new Date() } });
}

export interface CatalogCounts {
  servers: number;
  consumers: number;
  usages: number;
}

export async function currentCounts(): Promise<CatalogCounts> {
  const [row] = await db
    .select({
      servers: sql<number>`(select count(*)::int from servers)`,
      consumers: sql<number>`(select count(*)::int from consumers)`,
      usages: sql<number>`(select count(*)::int from usages)`,
    })
    .from(sql`(select 1) as _`);
  return { servers: row?.servers ?? 0, consumers: row?.consumers ?? 0, usages: row?.usages ?? 0 };
}

export async function startRun(before: CatalogCounts): Promise<string> {
  const id = randomUUID();
  await db.insert(ingestRuns).values({ id, before });
  return id;
}

export async function finishRun(id: string, after: CatalogCounts, note: string): Promise<void> {
  await db
    .update(ingestRuns)
    .set({ finishedAt: new Date(), after, note })
    .where(eq(ingestRuns.id, id));
}

/** The most recent COMPLETED run, for "since last time" reporting. */
export async function lastFinishedRun() {
  const [row] = await db
    .select()
    .from(ingestRuns)
    .where(isNotNull(ingestRuns.finishedAt))
    .orderBy(desc(ingestRuns.finishedAt))
    .limit(1);
  return row ?? null;
}
