/**
 * Demand-side crawl (REGISTRY-DESIGN.md §9 ingest).
 *
 * Finds public repos that committed an MCP client config, parses the referenced
 * servers, and records the consumer→server usage edge. Public data only; never
 * stores env values or secret-looking strings.
 *
 * Built to run in the BACKGROUND without blocking and to be cheap on the Neon
 * free plan:
 *   - resumable: a checkpoint file records processed hits, so a stopped run
 *     resumes without redoing work (re-run the same command);
 *   - frugal: writes are batched per repo, and the DB is untouched during the
 *     GitHub rate-limit sleeps, so Neon autosuspends through the waits;
 *   - bounded: depth and query count are env-configurable for a safe first run.
 *
 * Requires GITHUB_TOKEN (code search needs auth).
 *   npm run crawl                 # default-bounded run, resumes if interrupted
 *   CRAWL_MAX_PAGES=10 npm run crawl   # go deep (full 1000/query)
 *   CRAWL_QUERY_LIMIT=4 npm run crawl  # only the first 4 queries
 *   CRAWL_FRESH=1 npm run crawl        # ignore + reset the checkpoint
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  expandQueries,
  fetchFileContent,
  fetchRepoStars,
  searchConfigFiles,
  type CodeHit,
} from "../src/lib/sources/github-code";
import { parseMcpConfig, clientForPath } from "../src/lib/mcp-config";
import { specToCanonicalId } from "../src/lib/spec-identity";
import { ensureConsumer, recordUsagesBatch, type UsageRow } from "../src/lib/consumer-catalog";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES ?? "3");
const QUERY_LIMIT = process.env.CRAWL_QUERY_LIMIT
  ? Number(process.env.CRAWL_QUERY_LIMIT)
  : Infinity;
const CHECKPOINT = resolve(process.cwd(), ".crawl-state.json");

interface Checkpoint {
  processed: string[]; // "owner/repo/path" keys already handled
}

function loadCheckpoint(): Set<string> {
  if (process.env.CRAWL_FRESH) {
    if (existsSync(CHECKPOINT)) rmSync(CHECKPOINT);
    return new Set();
  }
  if (!existsSync(CHECKPOINT)) return new Set();
  try {
    const data = JSON.parse(readFileSync(CHECKPOINT, "utf8")) as Checkpoint;
    return new Set(data.processed ?? []);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(done: Set<string>) {
  writeFileSync(CHECKPOINT, JSON.stringify({ processed: [...done] }), "utf8");
}

const hitKey = (h: CodeHit) => `${h.owner}/${h.repo}/${h.path}`;

async function collectHits(): Promise<CodeHit[]> {
  const seen = new Set<string>();
  const all: CodeHit[] = [];
  const queries = expandQueries().slice(0, QUERY_LIMIT);
  for (const q of queries) {
    console.log(`  search: ${q}`);
    const hits = await searchConfigFiles(q, MAX_PAGES);
    for (const h of hits) {
      const key = hitKey(h);
      if (!seen.has(key)) {
        seen.add(key);
        all.push(h);
      }
    }
    await sleep(7000); // code search ~10 req/min
  }
  return all;
}

async function processHit(
  hit: CodeHit,
  starCache: Map<string, number | undefined>,
): Promise<number> {
  const content = await fetchFileContent(hit.owner, hit.repo, hit.path);
  if (!content) return 0;
  const specs = parseMcpConfig(content);
  if (specs.length === 0) return 0;

  const repoKey = `${hit.owner}/${hit.repo}`;
  if (!starCache.has(repoKey)) {
    starCache.set(repoKey, await fetchRepoStars(hit.owner, hit.repo));
  }
  const consumerId = await ensureConsumer(hit.owner, hit.repo, starCache.get(repoKey));
  if (!consumerId) return 0;

  const client = clientForPath(hit.path);
  const rows: UsageRow[] = specs.map((spec) => ({
    consumerId,
    server: specToCanonicalId(spec),
    configPath: hit.path,
    client,
    transport: spec.transport,
    envKeys: spec.envKeys,
  }));
  await recordUsagesBatch(rows); // one batched write per repo (frugal)
  return rows.length;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    console.error("GITHUB_TOKEN is required for code search. Add it to .env and retry.");
    process.exit(1);
  }

  const done = loadCheckpoint();
  console.log(
    `Config: maxPages=${MAX_PAGES}, queryLimit=${QUERY_LIMIT}, ` +
      `checkpoint=${done.size} already processed.\n`,
  );

  console.log("Searching for committed MCP configs…");
  const hits = await collectHits();
  const pending = hits.filter((h) => !done.has(hitKey(h)));
  console.log(
    `\nFound ${hits.length} config files (${pending.length} new). Following references…\n`,
  );

  const starCache = new Map<string, number | undefined>();
  let repos = 0;
  let edges = 0;
  for (const hit of pending) {
    const key = hitKey(hit);
    try {
      const n = await processHit(hit, starCache);
      if (n > 0) {
        repos++;
        edges += n;
        console.log(`  ✓ ${key} → ${n} server(s)`);
      }
    } catch (err) {
      console.log(`  ✗ ${key}: ${(err as Error).message}`);
    }
    done.add(key);
    saveCheckpoint(done); // resumable: persist after every hit
    await sleep(200); // gentle on the core API
  }
  console.log(`\nDone. ${edges} usage edges across ${repos} new repos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
