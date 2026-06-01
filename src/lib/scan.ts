/**
 * Stack scanner (the flagship "useful action"): given an MCP client config —
 * pasted, or fetched from a public GitHub repo — resolve every server to its
 * canonical identity (§11.1) and build a credibility report from the public
 * signals we already hold. Decision support, not a verdict.
 *
 * This is strictly READ-ONLY: scanning never writes a usage edge and never
 * stores the input. We parse for server identity only — env KEY NAMES at most,
 * never values, never the raw config (§10). We are not a secret scraper.
 *
 * Trust-language (§10.6): findings are framed as observations ("observed",
 * "unclaimed", "no SECURITY.md observed") — never "safe", "risky", or "verified".
 */

import { countDistinct, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { servers, serverVersions, usages } from "@/db/schema";
import { parseMcpConfig, type McpSpec } from "./mcp-config";
import { specToCanonicalId } from "./spec-identity";
import { idToHref } from "./serverPath";
import { recommendForStack } from "./insights";
import type { ServerKind } from "./identity";

export interface ScanFlag {
  level: "info" | "caution";
  text: string;
}

export interface ScanServer {
  inputName: string;
  id: string;
  kind: ServerKind;
  transport: McpSpec["transport"];
  known: boolean;
  href: string | null;
  displayName: string;
  description: string | null;
  claimed: boolean;
  hasSecurityMd: boolean | null;
  stars: number | null;
  weeklyDownloads: number | null;
  latestVersion: string | null;
  lastReleaseDays: number | null;
  observedInRepos: number;
  flags: ScanFlag[];
}

export interface ScanRecommendation {
  id: string;
  displayName: string;
  kind: ServerKind;
  repos: number;
  href: string;
}

export interface ScanReport {
  source: string;
  serverCount: number;
  knownCount: number;
  servers: ScanServer[];
  recommendations: ScanRecommendation[];
  notes: string[];
}

const DAY = 86_400_000;

/**
 * Build a report from already-parsed specs. Deduplicates by canonical id so a
 * config that wires the same server twice reports it once.
 */
export async function buildReport(
  specs: McpSpec[],
  source: string,
  notes: string[] = [],
): Promise<ScanReport> {
  // Resolve + dedupe, keeping the first input name we saw for each id.
  const byId = new Map<string, { spec: McpSpec; kind: ServerKind }>();
  for (const spec of specs) {
    const canonical = specToCanonicalId(spec);
    if (!byId.has(canonical.id)) byId.set(canonical.id, { spec, kind: canonical.kind });
  }
  const ids = [...byId.keys()];

  if (ids.length === 0) {
    return { source, serverCount: 0, knownCount: 0, servers: [], recommendations: [], notes };
  }

  const [serverRows, releaseRows, observedRows, recommendations] = await Promise.all([
    db.select().from(servers).where(inArray(servers.id, ids)),
    db
      .select({
        serverId: serverVersions.serverId,
        last: sql<string | null>`max(${serverVersions.publishedAt})`,
      })
      .from(serverVersions)
      .where(inArray(serverVersions.serverId, ids))
      .groupBy(serverVersions.serverId),
    db
      .select({ serverId: usages.serverId, n: countDistinct(usages.consumerId) })
      .from(usages)
      .where(inArray(usages.serverId, ids))
      .groupBy(usages.serverId),
    recommendForStack(ids).then((recs) =>
      recs.map((r) => ({ ...r, href: idToHref(r.id) })),
    ),
  ]);

  const serverById = new Map(serverRows.map((s) => [s.id, s]));
  const lastReleaseById = new Map(releaseRows.map((r) => [r.serverId, r.last]));
  const observedById = new Map(observedRows.map((r) => [r.serverId, r.n]));

  const list: ScanServer[] = [...byId.entries()].map(([id, { spec, kind }]) => {
    const s = serverById.get(id);
    const observed = observedById.get(id) ?? 0;
    const lastRaw = lastReleaseById.get(id) ?? null;
    const lastReleaseDays =
      lastRaw !== null ? Math.floor((Date.now() - new Date(lastRaw).getTime()) / DAY) : null;

    const flags: ScanFlag[] = [];
    if (!s) {
      flags.push({
        level: "info",
        text: "Not yet catalogued — we hold no public signal on this server.",
      });
    } else {
      if (s.claimedBy === null) {
        flags.push({ level: "info", text: "Unclaimed — no author-declared context." });
      }
      if (s.hasSecurityMd === false) {
        flags.push({ level: "caution", text: "No SECURITY.md observed in the source repo." });
      }
      if (lastReleaseDays !== null && lastReleaseDays > 365) {
        const years = Math.floor(lastReleaseDays / 365);
        flags.push({
          level: "caution",
          text: `No release in ${years}y+ (latest ${s.latestVersion ?? "unknown"}).`,
        });
      }
      if (observed === 0) {
        flags.push({ level: "info", text: "Not yet observed in any crawled public config." });
      }
    }
    if (spec.transport === "http" || spec.transport === "sse") {
      flags.push({ level: "info", text: "Remote endpoint — executes outside your machine." });
    }

    return {
      inputName: spec.name,
      id,
      kind,
      transport: spec.transport,
      known: Boolean(s),
      href: s ? idToHref(id) : null,
      displayName: s?.displayName ?? spec.name,
      description: s?.description ?? null,
      claimed: s?.claimedBy != null,
      hasSecurityMd: s?.hasSecurityMd ?? null,
      stars: s?.stars ?? null,
      weeklyDownloads: s?.weeklyDownloads ?? null,
      latestVersion: s?.latestVersion ?? null,
      lastReleaseDays,
      observedInRepos: observed,
      flags,
    };
  });

  // Stable ordering: known + most-observed first, unknowns last.
  list.sort((a, b) => Number(b.known) - Number(a.known) || b.observedInRepos - a.observedInRepos);

  return {
    source,
    serverCount: list.length,
    knownCount: list.filter((s) => s.known).length,
    servers: list,
    recommendations,
    notes,
  };
}

// --- Input handling --------------------------------------------------------

/** Parse "owner/name", a github.com URL, or git URL into {owner, name}. */
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, "");
  if (!s) return null;
  const m =
    s.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i) ||
    s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

const CANDIDATE_PATHS = [
  ".mcp.json",
  "mcp.json",
  ".cursor/mcp.json",
  ".vscode/mcp.json",
  ".claude/mcp.json",
  ".continue/config.json",
  "claude_desktop_config.json",
];

async function getJson(url: string, timeoutMs = 5000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ax-registry-scan" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, timeoutMs = 5000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ax-registry-scan" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Scan a public GitHub repo: resolve its default branch, then probe the
 * conventional MCP config locations on that branch (raw, unauthenticated).
 * Only public files at known config paths are read; nothing is stored.
 */
export async function scanRepo(owner: string, name: string): Promise<ScanReport> {
  const meta = (await getJson(`https://api.github.com/repos/${owner}/${name}`)) as
    | { default_branch?: string }
    | null;
  const branches = meta?.default_branch ? [meta.default_branch] : ["main", "master"];

  const specs: McpSpec[] = [];
  const foundPaths: string[] = [];
  for (const path of CANDIDATE_PATHS) {
    let content: string | null = null;
    for (const branch of branches) {
      content = await getText(
        `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${path}`,
      );
      if (content) break;
    }
    if (!content) continue;
    const parsed = parseMcpConfig(content);
    if (parsed.length > 0) {
      specs.push(...parsed);
      foundPaths.push(path);
    }
  }

  const notes =
    foundPaths.length > 0
      ? [`Read ${foundPaths.length} config file(s): ${foundPaths.join(", ")}.`]
      : [
          "No MCP config found at the conventional locations (.mcp.json, .cursor/mcp.json, .vscode/mcp.json, …). If it lives elsewhere, paste it below.",
        ];

  return buildReport(specs, `${owner}/${name}`, notes);
}

/** Scan a pasted config string. */
export async function scanPastedConfig(content: string): Promise<ScanReport> {
  const specs = parseMcpConfig(content);
  const notes =
    specs.length === 0
      ? ["No MCP servers found. Expected a JSON object with an \"mcpServers\" or \"servers\" key."]
      : [];
  return buildReport(specs, "pasted config", notes);
}
