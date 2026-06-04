/**
 * Static seed (REGISTRY-DESIGN.md §3 v1).
 *
 * Populates the static-seeded band for every MCP server we can find from public
 * sources — no contributors needed, useful day one. Three discovery axes:
 *   - npm    : paged search across many MCP-related queries          → npm:
 *   - PyPI   : search + JSON API + pypistats downloads               → pypi:
 *   - GitHub : repos tagged mcp-server / mcp-servers                 → repo:
 * npm runs first so repo aliases exist before topic discovery dedupes.
 *
 * Tunables (env): SEED_MAX_PER_QUERY, SEED_LIMIT, SEED_CONCURRENCY,
 *   SEED_PYPI_PAGES, SEED_GITHUB_PAGES, and toggles SEED_NPM / SEED_PYPI /
 *   SEED_GITHUB ("0" to skip a phase).
 *
 * Run: npm run seed   (DATABASE_URL required; GITHUB_TOKEN recommended)
 */

import "dotenv/config";
import { fetchNpmFacts, searchNpmServers } from "../src/lib/sources/npm";
import { searchPypiServers, fetchPypiFacts } from "../src/lib/sources/pypi";
import { fetchGitHubFacts, ownerRepoFromRepoId, searchReposByTopic } from "../src/lib/sources/github";
import { repoId } from "../src/lib/identity";
import { upsertFromNpm, upsertFromPypi, upsertRepoServer } from "../src/lib/catalog";

const CURATED = [
  "@modelcontextprotocol/server-filesystem",
  "@modelcontextprotocol/server-github",
  "@modelcontextprotocol/server-memory",
  "@modelcontextprotocol/server-everything",
  "@modelcontextprotocol/server-sequential-thinking",
  "@modelcontextprotocol/sdk",
];

// Breadth is the discovery lever (the seed has no cursor — one run exhausts a
// query, so adding *distinct* queries is what finds new servers; re-running the
// same list does not). Each term targets a different integration/domain/client
// so overlap is low; the write path dedups, so extra terms are not wasted.
const NPM_QUERIES = [
  // core protocol terms
  "modelcontextprotocol server", "mcp server", "mcp-server", "model context protocol",
  "@modelcontextprotocol", "mcp", "claude mcp", "mcp tool", "mcp client", "mcp stdio",
  "mcp sse", "mcp http", "ai agent tool server", "fastmcp", "mcp toolkit", "mcp connector",
  "mcp integration", "mcp bridge", "mcp gateway", "mcp proxy", "mcp agent",
  // data stores / infra
  "mcp postgres", "mcp mysql", "mcp sqlite", "mcp mongodb", "mcp redis", "mcp snowflake",
  "mcp bigquery", "mcp duckdb", "mcp database", "mcp vector", "mcp s3", "mcp kubernetes",
  "mcp docker", "mcp aws", "mcp azure", "mcp gcp",
  // dev / SCM / pm
  "mcp github", "mcp gitlab", "mcp jira", "mcp linear", "mcp confluence", "mcp sentry",
  // productivity / SaaS
  "mcp slack", "mcp notion", "mcp google drive", "mcp gmail", "mcp calendar", "mcp obsidian",
  "mcp todoist", "mcp discord", "mcp telegram", "mcp stripe", "mcp shopify", "mcp salesforce",
  // web / browser / files / misc
  "mcp playwright", "mcp puppeteer", "mcp browser", "mcp fetch", "mcp web search",
  "mcp filesystem", "mcp pdf", "mcp memory", "mcp time", "mcp maps", "mcp youtube",
  // clients / sdks
  "cursor mcp", "windsurf mcp", "cline mcp", "continue mcp", "anthropic mcp", "openai mcp",
  "mcp typescript sdk", "mcp node",
];
const PYPI_QUERIES = [
  "mcp", "model context protocol", "mcp server", "fastmcp", "model context protocol server",
  "mcp tool", "mcp client", "fastmcp server", "mcp agent", "anthropic mcp",
  "mcp integration", "mcp connector", "llm tool server",
];
const GITHUB_TOPICS = [
  "mcp-server", "mcp-servers", "model-context-protocol-server", "mcp", "modelcontextprotocol",
  "model-context-protocol", "mcp-tools", "mcp-tool", "mcp-client", "mcp-clients", "claude-mcp",
];

const MAX_PER_QUERY = Number(process.env.SEED_MAX_PER_QUERY ?? "500");
const SEED_LIMIT = process.env.SEED_LIMIT ? Number(process.env.SEED_LIMIT) : Infinity;
const CONCURRENCY = Math.max(1, Number(process.env.SEED_CONCURRENCY ?? "6"));
const PYPI_PAGES = Number(process.env.SEED_PYPI_PAGES ?? "15");
const GITHUB_PAGES = Number(process.env.SEED_GITHUB_PAGES ?? "10");
const on = (k: string) => process.env[k] !== "0";

const PAGE = 250;

async function mapPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

// ── npm ──────────────────────────────────────────────────────────────────────
async function collectNpm(): Promise<string[]> {
  const found = new Set<string>(CURATED);
  for (const q of NPM_QUERIES) {
    for (let from = 0; from < MAX_PER_QUERY; from += PAGE) {
      let names: string[];
      try {
        names = await searchNpmServers(q, PAGE, from);
      } catch {
        break;
      }
      for (const n of names) found.add(n);
      if (names.length < PAGE) break;
      if (found.size >= SEED_LIMIT) break;
    }
    if (found.size >= SEED_LIMIT) break;
  }
  return [...found];
}

async function seedNpmOne(pkg: string): Promise<boolean> {
  const npm = await fetchNpmFacts(pkg);
  if (!npm) return false;
  let gh;
  if (npm.repositoryUrl) {
    const repo = repoId(npm.repositoryUrl, npm.repositoryDir);
    const or = repo ? ownerRepoFromRepoId(repo.id) : undefined;
    if (or) gh = await fetchGitHubFacts(or.owner, or.repo);
  }
  await upsertFromNpm(npm, gh);
  return true;
}

async function seedNpm(): Promise<void> {
  console.log("[npm] collecting candidates…");
  const candidates = await collectNpm();
  console.log(`[npm] seeding ${candidates.length} (concurrency ${CONCURRENCY})`);
  let ok = 0, done = 0;
  await mapPool(candidates, CONCURRENCY, async (pkg) => {
    try { if (await seedNpmOne(pkg)) ok++; } catch { /* skip */ }
    if (++done % 200 === 0) console.log(`  …${done}/${candidates.length}`);
  });
  console.log(`[npm] done — ${ok} seeded`);
}

// ── PyPI ─────────────────────────────────────────────────────────────────────
async function collectPypi(): Promise<string[]> {
  const found = new Set<string>();
  for (const q of PYPI_QUERIES) {
    for (let page = 1; page <= PYPI_PAGES; page++) {
      const names = await searchPypiServers(q, page);
      if (names.length === 0) break;
      for (const n of names) found.add(n);
    }
  }
  return [...found];
}

async function seedPypi(): Promise<void> {
  console.log("[pypi] collecting candidates…");
  const candidates = await collectPypi();
  console.log(`[pypi] seeding ${candidates.length} (concurrency ${CONCURRENCY})`);
  let ok = 0, done = 0;
  await mapPool(candidates, CONCURRENCY, async (name) => {
    try {
      const py = await fetchPypiFacts(name);
      if (!py) return;
      let gh;
      if (py.repositoryUrl) {
        const repo = repoId(py.repositoryUrl);
        const or = repo ? ownerRepoFromRepoId(repo.id) : undefined;
        if (or) gh = await fetchGitHubFacts(or.owner, or.repo);
      }
      await upsertFromPypi(py, gh);
      ok++;
    } catch { /* skip */ }
    if (++done % 200 === 0) console.log(`  …${done}/${candidates.length}`);
  });
  console.log(`[pypi] done — ${ok} seeded`);
}

// ── GitHub topics ──────────────────────────────────────────────────────────────
async function seedGithubTopics(): Promise<void> {
  console.log("[github] discovering repos by topic…");
  let created = 0, skipped = 0;
  for (const topic of GITHUB_TOPICS) {
    const repos = await searchReposByTopic(topic, GITHUB_PAGES);
    for (const r of repos) {
      const repo = repoId(`github.com/${r.owner}/${r.name}`);
      if (!repo) continue;
      try {
        const res = await upsertRepoServer(repo, {
          displayName: `${r.owner}/${r.name}`,
          description: r.description,
          homepage: r.homepage,
          repoUrl: `https://github.com/${r.owner}/${r.name}`,
          stars: r.stars,
          license: r.license,
        });
        if (res === "created") created++;
        else skipped++;
      } catch { /* skip */ }
    }
    console.log(`  topic:${topic} → ${repos.length} repos`);
  }
  console.log(`[github] done — ${created} repo servers, ${skipped} already merged`);
}

async function main(): Promise<void> {
  if (on("SEED_NPM")) await seedNpm();
  if (on("SEED_PYPI")) await seedPypi();
  if (on("SEED_GITHUB")) await seedGithubTopics();
  console.log("\nSeed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
