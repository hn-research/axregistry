/**
 * Enrichment pass. The crawl discovers servers as thin "listed" stubs (just an
 * id + a placeholder name). This backfills real static facts — description,
 * downloads, stars, license, versions — for npm servers that are missing them,
 * and refreshes ones whose facts have gone stale. Bounded per run so it's safe
 * on a daily schedule and within rate limits.
 *
 * Tunables (env):
 *   ENRICH_LIMIT=300         servers to (re)enrich this run
 *   ENRICH_STALE_DAYS=7      refresh facts older than this many days
 *   ENRICH_CONCURRENCY=6     parallel fetches
 *
 * Run: npm run enrich   (DATABASE_URL required; GITHUB_TOKEN recommended)
 */

import "dotenv/config";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../src/db";
import { servers } from "../src/db/schema";
import { fetchNpmFacts, type NpmFacts } from "../src/lib/sources/npm";
import { fetchGitHubFacts, ownerRepoFromRepoId } from "../src/lib/sources/github";
import { repoId } from "../src/lib/identity";
import { upsertFromNpm } from "../src/lib/catalog";

const LIMIT = Number(process.env.ENRICH_LIMIT ?? "300");
const STALE_DAYS = Number(process.env.ENRICH_STALE_DAYS ?? "7");
const CONCURRENCY = Math.max(1, Number(process.env.ENRICH_CONCURRENCY ?? "6"));

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);

  // npm servers that are stubs (never refreshed) or stale, stubs first.
  const rows = await db
    .select({ id: servers.id })
    .from(servers)
    .where(
      and(
        eq(servers.kind, "npm"),
        or(isNull(servers.lastStaticRefresh), lt(servers.lastStaticRefresh, cutoff)),
      ),
    )
    .orderBy(sql`${servers.lastStaticRefresh} asc nulls first`)
    .limit(LIMIT);

  console.log(`Enriching ${rows.length} npm servers (concurrency ${CONCURRENCY}).`);

  let ok = 0;
  let skip = 0;
  await mapPool(rows, CONCURRENCY, async ({ id }) => {
    const pkg = id.startsWith("npm:") ? id.slice(4) : id;
    let npm: NpmFacts | undefined;
    try {
      npm = await fetchNpmFacts(pkg);
    } catch {
      /* network */
    }
    if (!npm) {
      skip++;
      return;
    }
    let gh;
    if (npm.repositoryUrl) {
      const repo = repoId(npm.repositoryUrl, npm.repositoryDir);
      const or2 = repo ? ownerRepoFromRepoId(repo.id) : undefined;
      if (or2) {
        try {
          gh = await fetchGitHubFacts(or2.owner, or2.repo);
        } catch {
          /* rate limit */
        }
      }
    }
    try {
      await upsertFromNpm(npm, gh);
      ok++;
    } catch {
      skip++;
    }
  });

  console.log(`Done. ${ok} enriched, ${skip} skipped.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
