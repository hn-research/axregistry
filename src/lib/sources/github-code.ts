/**
 * GitHub code search — demand-side discovery source.
 *
 * Finds PUBLIC repos that committed an MCP client config, so we can follow
 * their referenced servers and retain the consumer→server edge. Code search
 * requires a token and is rate-limited (~10 req/min); the crawler paces itself.
 */

const API = "https://api.github.com";

export interface CodeHit {
  owner: string;
  repo: string;
  path: string;
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Content-term + filename queries that surface committed MCP configs, one per
 * client/surface. Each distinct query is its own ≤1000-result bucket on GitHub
 * code search, so widening this list multiplies breadth directly. We only list
 * surfaces whose JSON shape our parser understands (mcpServers / servers).
 */
export const CONFIG_QUERIES: string[] = [
  "mcpServers filename:mcp.json",
  "mcpServers filename:.mcp.json", // Claude Code (project)
  "mcpServers filename:claude_desktop_config.json", // Claude Desktop
  "mcpServers filename:mcp.json path:.cursor", // Cursor
  "servers filename:mcp.json path:.vscode", // VS Code
  "mcpServers filename:mcp_config.json", // Windsurf / Codeium
  "mcpServers filename:config.json path:.continue", // Continue
  "mcpServers filename:cline_mcp_settings.json", // Cline
  "mcpServers filename:kilocode_mcp_settings.json", // Kilo Code
  "mcpServers filename:mcp.json path:.kiro", // Kiro
  "mcpServers filename:settings.json", // VS Code user settings & embedders
  "mcpServers filename:servers.json",
];

/**
 * Broad catch-all queries that would blow past GitHub's hard 1000-result cap.
 * We shard each by file-size window so each shard stays under the cap and the
 * union reaches deeper than a single query could. (Size is a good shard key for
 * config files — language/path don't discriminate JSON configs.)
 */
export const SHARDED_QUERIES: string[] = ["mcpServers extension:json"];
const SIZE_SHARDS = ["size:0..1500", "size:1501..6000", "size:>6000"];

/** The full query set: explicit surfaces plus size-sharded catch-alls. */
export function expandQueries(): string[] {
  const out = [...CONFIG_QUERIES];
  for (const q of SHARDED_QUERIES) {
    for (const s of SIZE_SHARDS) out.push(`${q} ${s}`);
  }
  return out;
}

/**
 * Run one code-search query, paging up to `maxPages` (100 hits/page, GitHub
 * caps total at 1000). Returns de-duplicated file hits.
 */
export async function searchConfigFiles(
  query: string,
  maxPages = 3,
  signal?: AbortSignal,
): Promise<CodeHit[]> {
  const hits: CodeHit[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${API}/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
    const init: RequestInit = { headers: ghHeaders() };
    if (signal) init.signal = signal;
    const r = await fetch(url, init);
    if (!r.ok) break; // rate limit / no token / no more results
    const body = (await r.json()) as {
      items?: { path?: string; repository?: { full_name?: string } }[];
    };
    const items = body.items ?? [];
    for (const it of items) {
      const full = it.repository?.full_name;
      if (!full || !it.path) continue;
      const [owner, repo] = full.split("/");
      if (owner && repo) hits.push({ owner, repo, path: it.path });
    }
    if (items.length < 100) break;
  }
  return hits;
}

/** Fetch a file's decoded text via the contents API (default branch). */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const url = `${API}/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const init: RequestInit = { headers: ghHeaders() };
  if (signal) init.signal = signal;
  try {
    const r = await fetch(url, init);
    if (!r.ok) return undefined;
    const body = (await r.json()) as { content?: string; encoding?: string };
    if (body.encoding === "base64" && body.content) {
      return Buffer.from(body.content, "base64").toString("utf8");
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Fetch repo stars (best-effort). */
export async function fetchRepoStars(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const init: RequestInit = { headers: ghHeaders() };
  if (signal) init.signal = signal;
  try {
    const r = await fetch(`${API}/repos/${owner}/${repo}`, init);
    if (!r.ok) return undefined;
    const body = (await r.json()) as { stargazers_count?: number };
    return typeof body.stargazers_count === "number" ? body.stargazers_count : undefined;
  } catch {
    return undefined;
  }
}
