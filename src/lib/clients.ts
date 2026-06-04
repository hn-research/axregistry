/**
 * Client landscape — the reverse of the server-centric view. Where the catalog
 * answers "who uses this server," this answers "which servers does each MCP
 * client run." Every usage edge is tagged with the client whose config it came
 * from (`usages.client`, set by clientForPath during the crawl), so this is
 * computable today from public configs — no ax-ray submissions required.
 *
 * Provenance tiers (kept parallel, never blended):
 *   • public configs (now)     — static configs committed to public repos.
 *   • ax-ray submissions (grows)— live on-machine usage. Different blind spots:
 *     the crawl is strong for repo-committed clients (cursor/vscode/.mcp.json),
 *     weak for local-only ones (claude-desktop); ax-ray is strong exactly there.
 */

import { db } from "@/db";
import { servers, usages } from "@/db/schema";
import type { Server } from "@/db/schema";
import { count, countDistinct, desc, eq } from "drizzle-orm";
import { cached } from "@/lib/cache";

/** Display metadata for known client/host ids (the values clientForPath emits). */
export const CLIENT_META: Record<string, { label: string; blurb: string }> = {
  cursor: { label: "Cursor", blurb: "The Cursor editor's MCP configuration." },
  "claude-desktop": { label: "Claude Desktop", blurb: "Anthropic's desktop app MCP config." },
  "claude-code": { label: "Claude Code", blurb: "Anthropic's CLI/agent MCP config." },
  vscode: { label: "VS Code", blurb: "VS Code (and Copilot) MCP configuration." },
  cline: { label: "Cline", blurb: "The Cline VS Code extension's MCP config." },
  continue: { label: "Continue", blurb: "The Continue assistant's MCP config." },
  windsurf: { label: "Windsurf", blurb: "The Windsurf editor's MCP config." },
  zed: { label: "Zed", blurb: "The Zed editor's MCP configuration." },
  unknown: { label: "Unknown / other", blurb: "Configs we couldn't attribute to a known client." },
};

export function clientLabel(id: string): string {
  return CLIENT_META[id]?.label ?? id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function clientBlurb(id: string): string {
  return CLIENT_META[id]?.blurb ?? "MCP configurations attributed to this client.";
}

export interface ClientServerRow {
  serverId: string;
  displayName: string;
  kind: Server["kind"];
  /** Distinct public repos wiring this server up *via this client*. */
  repos: number;
}

export interface ClientGroup {
  id: string;
  label: string;
  blurb: string;
  /** Distinct servers configured via this client. */
  servers: number;
  /** Distinct repos that configure any server via this client. */
  repos: number;
  /** Total (server,repo) placements seen for this client. */
  placements: number;
  /** Servers ranked by distinct repos (desc). Capped for the landscape view. */
  top: ClientServerRow[];
}

/** Sort key: by reach (repos) desc, but always push "unknown" to the end. */
function landscapeSort(a: ClientGroup, b: ClientGroup): number {
  if (a.id === "unknown") return 1;
  if (b.id === "unknown") return -1;
  return b.repos - a.repos || b.servers - a.servers;
}

/** Every client with headline stats + its top servers. One pair of grouped queries. */
async function _getClientLandscape(topPerClient = 6): Promise<ClientGroup[]> {
  const [statRows, topRows] = await Promise.all([
    db
      .select({
        client: usages.client,
        servers: countDistinct(usages.serverId),
        repos: countDistinct(usages.consumerId),
        placements: count(),
      })
      .from(usages)
      .groupBy(usages.client),
    db
      .select({
        client: usages.client,
        serverId: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        repos: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .groupBy(usages.client, usages.serverId, servers.displayName, servers.kind)
      .orderBy(desc(countDistinct(usages.consumerId)))
      .limit(20000),
  ]);

  // Bucket top servers per client; global repos-desc order is preserved per bucket.
  const buckets = new Map<string, ClientServerRow[]>();
  for (const r of topRows) {
    const arr = buckets.get(r.client) ?? [];
    if (arr.length < topPerClient) {
      arr.push({ serverId: r.serverId, displayName: r.displayName, kind: r.kind, repos: r.repos });
    }
    buckets.set(r.client, arr);
  }

  return statRows
    .map((s) => ({
      id: s.client,
      label: clientLabel(s.client),
      blurb: clientBlurb(s.client),
      servers: s.servers,
      repos: s.repos,
      placements: s.placements,
      top: buckets.get(s.client) ?? [],
    }))
    .filter((g) => g.servers > 0)
    .sort(landscapeSort);
}
export const getClientLandscape = cached(_getClientLandscape, ["getClientLandscape"]);

export interface ClientDetail extends ClientGroup {
  /** Full ranked server list (not just the landscape cap). */
  all: ClientServerRow[];
}

/** One client's full ranked server list + stats, or null if it has no data. */
async function _getClient(clientId: string, limit = 1000): Promise<ClientDetail | null> {
  const [statRow, rows] = await Promise.all([
    db
      .select({
        servers: countDistinct(usages.serverId),
        repos: countDistinct(usages.consumerId),
        placements: count(),
      })
      .from(usages)
      .where(eq(usages.client, clientId)),
    db
      .select({
        serverId: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        repos: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .where(eq(usages.client, clientId))
      .groupBy(usages.serverId, servers.displayName, servers.kind)
      .orderBy(desc(countDistinct(usages.consumerId)))
      .limit(limit),
  ]);

  const stat = statRow[0];
  if (!stat || stat.servers === 0) return null;

  const all: ClientServerRow[] = rows.map((r) => ({
    serverId: r.serverId,
    displayName: r.displayName,
    kind: r.kind,
    repos: r.repos,
  }));

  return {
    id: clientId,
    label: clientLabel(clientId),
    blurb: clientBlurb(clientId),
    servers: stat.servers,
    repos: stat.repos,
    placements: stat.placements,
    top: all.slice(0, 6),
    all,
  };
}
export const getClient = cached(_getClient, ["getClient"]);

// ── Client × server matrix (the cross-client heatmap) ───────────────────────

export interface MatrixClient {
  id: string;
  label: string;
  /** Distinct repos configuring any server via this client. */
  total: number;
}

export interface MatrixServer {
  serverId: string;
  displayName: string;
  kind: Server["kind"];
  /** Repos across all clients (sum of cells) — the row's overall reach. */
  total: number;
  /** client id → distinct repos using this server via that client. */
  byClient: Record<string, number>;
}

export interface ClientServerMatrix {
  clients: MatrixClient[];
  servers: MatrixServer[];
  /** Largest single cell value among the rendered cells (for colour scaling). */
  max: number;
}

/**
 * Cross-client adoption matrix: the top servers (rows) × the busiest clients
 * (cols), each cell = distinct repos wiring that server up via that client.
 * Surfaces "which servers run in which client" and common-vs-specific patterns.
 */
async function _getClientServerMatrix(
  topServers = 25,
  maxClients = 8,
): Promise<ClientServerMatrix> {
  const [cellRows, clientTotals] = await Promise.all([
    db
      .select({
        serverId: usages.serverId,
        displayName: servers.displayName,
        kind: servers.kind,
        client: usages.client,
        repos: countDistinct(usages.consumerId),
      })
      .from(usages)
      .innerJoin(servers, eq(servers.id, usages.serverId))
      .groupBy(usages.serverId, servers.displayName, servers.kind, usages.client),
    db
      .select({ client: usages.client, total: countDistinct(usages.consumerId) })
      .from(usages)
      .groupBy(usages.client),
  ]);

  // Columns: busiest clients first, "unknown" last, capped.
  const clients: MatrixClient[] = clientTotals
    .map((c) => ({ id: c.client, label: clientLabel(c.client), total: c.total }))
    .sort((a, b) => (a.id === "unknown" ? 1 : b.id === "unknown" ? -1 : b.total - a.total))
    .slice(0, maxClients);
  const colSet = new Set(clients.map((c) => c.id));

  // Rows: aggregate cells per server, rank by total reach.
  const byServer = new Map<string, MatrixServer>();
  for (const r of cellRows) {
    let row = byServer.get(r.serverId);
    if (!row) {
      row = {
        serverId: r.serverId,
        displayName: r.displayName,
        kind: r.kind,
        total: 0,
        byClient: {},
      };
      byServer.set(r.serverId, row);
    }
    row.total += r.repos;
    if (colSet.has(r.client)) row.byClient[r.client] = (row.byClient[r.client] ?? 0) + r.repos;
  }

  const rows = [...byServer.values()].sort((a, b) => b.total - a.total).slice(0, topServers);

  let max = 0;
  for (const row of rows) for (const c of clients) max = Math.max(max, row.byClient[c.id] ?? 0);

  return { clients, servers: rows, max: max || 1 };
}
export const getClientServerMatrix = cached(_getClientServerMatrix, ["getClientServerMatrix"]);
