/**
 * Static seed (REGISTRY-DESIGN.md §3 v1).
 *
 * Populates the static-seeded band for every MCP server we can find from
 * public sources — no contributors needed, useful day one. Discovery:
 *   - a curated starter set of well-known servers, plus
 *   - npm search for MCP-related packages.
 * For each: npm facts → canonical npm: id (+ repo alias), then GitHub facts.
 *
 * Run: npm run seed   (requires DATABASE_URL in .env)
 */

import "dotenv/config";
import { fetchNpmFacts, searchNpmServers } from "../src/lib/sources/npm";
import { fetchGitHubFacts, ownerRepoFromRepoId } from "../src/lib/sources/github";
import { repoId } from "../src/lib/identity";
import { upsertFromNpm } from "../src/lib/catalog";

const CURATED = [
  "@modelcontextprotocol/server-filesystem",
  "@modelcontextprotocol/server-github",
  "@modelcontextprotocol/server-memory",
  "@modelcontextprotocol/server-everything",
  "@modelcontextprotocol/server-sequential-thinking",
  "@modelcontextprotocol/sdk",
];

const SEARCH_QUERIES = ["modelcontextprotocol server", "mcp server", "mcp-server"];

async function collectCandidates(): Promise<string[]> {
  const found = new Set<string>(CURATED);
  for (const q of SEARCH_QUERIES) {
    try {
      const names = await searchNpmServers(q, 100);
      for (const n of names) found.add(n);
    } catch {
      // best-effort; skip a failing query
    }
  }
  return [...found];
}

async function seedOne(pkg: string): Promise<"ok" | "skip"> {
  const npm = await fetchNpmFacts(pkg);
  if (!npm) return "skip";

  let gh;
  if (npm.repositoryUrl) {
    const repo = repoId(npm.repositoryUrl, npm.repositoryDir);
    const or = repo ? ownerRepoFromRepoId(repo.id) : undefined;
    if (or) gh = await fetchGitHubFacts(or.owner, or.repo);
  }

  const { id, repoAlias } = await upsertFromNpm(npm, gh);
  const stars = gh?.stars !== undefined ? ` ★${gh.stars}` : "";
  const dl = npm.weeklyDownloads !== undefined ? ` ↓${npm.weeklyDownloads}/wk` : "";
  console.log(`  ✓ ${id}${stars}${dl}${repoAlias ? `  (alias ${repoAlias})` : ""}`);
  return "ok";
}

async function main(): Promise<void> {
  console.log("Collecting candidate packages…");
  const candidates = await collectCandidates();
  console.log(`Seeding ${candidates.length} candidates.\n`);

  let ok = 0;
  let skip = 0;
  for (const pkg of candidates) {
    try {
      const r = await seedOne(pkg);
      if (r === "ok") ok++;
      else skip++;
    } catch (err) {
      skip++;
      console.log(`  ✗ ${pkg}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDone. ${ok} seeded, ${skip} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
