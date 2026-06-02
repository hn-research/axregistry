/**
 * Community-observed intelligence (§5) — the opt-in ax-ray signal that is the
 * registry's data moat. ax-ray submits, per server it found locally, *which
 * checks fired* (finding ids), positive flags, a grade, transport, env KEY
 * names, and an optional tool-surface hash — never a value, path, secret, or
 * machine id. We resolve each to a canonical server, store one row per
 * (server, anonymous contributor), and expose aggregates only at/above the
 * k-anonymity floor (k>=5).
 *
 * The endpoint enforces the privacy floor server-side (see `sanitizeServer`),
 * so a misbehaving client cannot push anything but the safe, structured shape.
 */

import { createHash } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { serverFindings, servers } from "@/db/schema";
import type { Kind } from "@/lib/kindStyle";
import { npmId, ociId, pypiId, repoId, remoteId, moreAuthoritative, type CanonicalId } from "@/lib/identity";
import { resolveCanonicalId, K_FLOOR } from "@/lib/queries";
import { ensureServerStub } from "@/lib/consumer-catalog";
import { cached } from "@/lib/cache";

// ── validation shapes (the privacy floor, enforced) ─────────────────────────
const RE_FINDING = /^[A-Z]{1,4}\d{1,3}$/;
const RE_ENVKEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RE_GRADE = /^[A-F]$/;
const RE_HASH = /^[0-9a-f]{64}$/;
const RE_NPM = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const RE_PYPI = /^[a-z0-9][\w.-]*$/i;
const RE_VERSION = /^[\w.\-+]{1,40}$/;
const TRANSPORTS = new Set(["stdio", "sse", "http"]);
const MAX_SERVERS = 300;
const MAX_ARR = 60;

function strArray(v: unknown, re: RegExp, max = MAX_ARR): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === "string" && x.length <= 80 && re.test(x)) out.push(x);
    if (out.length >= max) break;
  }
  return [...new Set(out)].sort();
}

export interface IngestServer {
  id: { npm?: string; pypi?: string; oci?: string; repo?: string; remoteOrigin?: string; cmdHash?: string };
  transport?: string;
  envKeys?: string[];
  findings?: string[];
  positiveFlags?: string[];
  grade?: string;
  tier?: number;
  toolSurfaceHash?: string;
  version?: string;
  client?: string;
}

export interface CleanServer {
  canonical: CanonicalId;
  client: string | null;
  grade: string | null;
  tier: number | null;
  transport: string | null;
  version: string | null;
  findingIds: string[];
  positiveFlagIds: string[];
  envKeys: string[];
  toolSurfaceHash: string | null;
}

/** Resolve the privacy-safe identity descriptor to one canonical id (precedence). */
function resolveDescriptor(d: IngestServer["id"]): CanonicalId | null {
  const c: CanonicalId[] = [];
  if (typeof d?.npm === "string" && RE_NPM.test(d.npm)) c.push(npmId(d.npm));
  if (typeof d?.oci === "string" && d.oci.length <= 200) c.push(ociId(d.oci));
  if (typeof d?.pypi === "string" && RE_PYPI.test(d.pypi)) c.push(pypiId(d.pypi));
  if (typeof d?.repo === "string") { const r = repoId(d.repo); if (r) c.push(r); }
  if (typeof d?.remoteOrigin === "string") { const r = remoteId(d.remoteOrigin); if (r) c.push(r); }
  if (typeof d?.cmdHash === "string" && RE_HASH.test(d.cmdHash)) c.push({ id: `cmd:sha256:${d.cmdHash}`, kind: "cmd" });
  if (c.length === 0) return null;
  return c.reduce(moreAuthoritative);
}

/** Strip a submitted server to the safe shape; null if it has no resolvable identity. */
export function sanitizeServer(raw: unknown): CleanServer | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as IngestServer;
  const canonical = resolveDescriptor(s.id ?? {});
  if (!canonical) return null;
  const grade = typeof s.grade === "string" && RE_GRADE.test(s.grade) ? s.grade : null;
  const tier = typeof s.tier === "number" && s.tier >= 0 && s.tier <= 4 ? Math.floor(s.tier) : null;
  const transport = typeof s.transport === "string" && TRANSPORTS.has(s.transport) ? s.transport : null;
  const version = typeof s.version === "string" && RE_VERSION.test(s.version) ? s.version : null;
  const client = typeof s.client === "string" && /^[a-z0-9][\w.-]{0,40}$/i.test(s.client) ? s.client : null;
  const toolSurfaceHash =
    typeof s.toolSurfaceHash === "string" && RE_HASH.test(s.toolSurfaceHash) ? s.toolSurfaceHash : null;
  return {
    canonical,
    client,
    grade,
    tier,
    transport,
    version,
    findingIds: strArray(s.findings, RE_FINDING),
    positiveFlagIds: strArray(s.positiveFlags, RE_FINDING),
    envKeys: strArray(s.envKeys, RE_ENVKEY),
    toolSurfaceHash,
  };
}

/** Hash the anonymous install token — defense in depth; deterministic for dedup. */
export function hashContributor(token: string): string {
  return createHash("sha256").update(`axray:${token}`).digest("hex");
}

export interface IngestResult {
  accepted: number;
  skipped: number;
  servers: { id: string; created: boolean }[];
  /** Newly-created stubs — the caller enriches these async (off the response path). */
  discovered: string[];
}

/** Record one contributor's submission across many servers (upsert per server). */
export async function recordSubmission(
  contributorToken: string,
  rawServers: unknown[],
): Promise<IngestResult> {
  const contributorId = hashContributor(contributorToken);
  const cleaned = rawServers.slice(0, MAX_SERVERS).map(sanitizeServer).filter((x): x is CleanServer => x !== null);

  const out: IngestResult = {
    accepted: 0,
    skipped: rawServers.length - cleaned.length,
    servers: [],
    discovered: [],
  };
  for (const s of cleaned) {
    // Resolve to an existing canonical row (alias-aware); create a stub if new.
    let serverId = await resolveCanonicalId(s.canonical.id);
    let created = false;
    if (!serverId) {
      await ensureServerStub(s.canonical);
      serverId = s.canonical.id;
      created = true;
      out.discovered.push(serverId);
    }

    // Is this a NEW contributor for this server? (drives the denormalized count)
    const [existing] = await db
      .select({ x: sql`1` })
      .from(serverFindings)
      .where(and(eq(serverFindings.serverId, serverId), eq(serverFindings.contributorId, contributorId)))
      .limit(1);

    await db
      .insert(serverFindings)
      .values({
        serverId,
        contributorId,
        client: s.client,
        grade: s.grade,
        tier: s.tier,
        transport: s.transport,
        version: s.version,
        findingIds: s.findingIds,
        positiveFlagIds: s.positiveFlagIds,
        envKeys: s.envKeys,
        toolSurfaceHash: s.toolSurfaceHash,
      })
      .onConflictDoUpdate({
        target: [serverFindings.serverId, serverFindings.contributorId],
        set: {
          client: s.client,
          grade: s.grade,
          tier: s.tier,
          transport: s.transport,
          version: s.version,
          findingIds: s.findingIds,
          positiveFlagIds: s.positiveFlagIds,
          envKeys: s.envKeys,
          toolSurfaceHash: s.toolSurfaceHash,
          submittedAt: new Date(),
        },
      });

    // First time this contributor reports this server → bump the presence count.
    if (!existing) {
      await db
        .update(servers)
        .set({ axrayReports: sql`${servers.axrayReports} + 1` })
        .where(eq(servers.id, serverId));
    }
    out.accepted++;
    out.servers.push({ id: serverId, created });
  }
  return out;
}

// ── read side (k-floored aggregate) ─────────────────────────────────────────
export interface Intelligence {
  contributorCount: number;
  /** finding id -> share of contributors (0..1) */
  findings: { id: string; count: number; share: number }[];
  positiveFlags: { id: string; count: number; share: number }[];
  grades: { grade: string; count: number }[];
  transports: { transport: string; count: number }[];
  envKeys: { key: string; count: number }[];
}

async function _getIntelligence(serverId: string): Promise<Intelligence | null> {
  const rows = await db
    .select()
    .from(serverFindings)
    .where(eq(serverFindings.serverId, serverId))
    .limit(5000);

  const n = rows.length;
  if (n < K_FLOOR) return null; // k-anonymity floor — never expose below k

  const tally = (arr: string[][]) => {
    const m = new Map<string, number>();
    for (const list of arr) for (const x of new Set(list)) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const findingsM = tally(rows.map((r) => (r.findingIds as string[]) ?? []));
  const flagsM = tally(rows.map((r) => (r.positiveFlagIds as string[]) ?? []));
  const envM = tally(rows.map((r) => (r.envKeys as string[]) ?? []));
  const gradeM = new Map<string, number>();
  const transM = new Map<string, number>();
  for (const r of rows) {
    if (r.grade) gradeM.set(r.grade, (gradeM.get(r.grade) ?? 0) + 1);
    if (r.transport) transM.set(r.transport, (transM.get(r.transport) ?? 0) + 1);
  }
  const rank = (m: Map<string, number>) =>
    [...m.entries()].map(([id, count]) => ({ id, count, share: count / n })).sort((a, b) => b.count - a.count);

  return {
    contributorCount: n,
    findings: rank(findingsM),
    positiveFlags: rank(flagsM),
    grades: [...gradeM.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade)),
    transports: [...transM.entries()].map(([transport, count]) => ({ transport, count })),
    envKeys: [...envM.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, 12),
  };
}

export const getIntelligence = cached(_getIntelligence, ["getIntelligence"], { revalidate: 600 });

// ── the Intelligence section: servers carrying community (ax-ray) signal ─────
export interface AxrayServer {
  id: string;
  kind: Kind;
  displayName: string;
  reports: number;
  /** At/above the k-floor → aggregated intelligence is available. */
  hasIntelligence: boolean;
}

/** Servers that have received ax-ray submissions, most-reported first. */
async function _getAxrayReportedServers(limit = 200): Promise<AxrayServer[]> {
  const rows = await db
    .select({
      id: servers.id,
      kind: servers.kind,
      displayName: servers.displayName,
      reports: servers.axrayReports,
    })
    .from(servers)
    .where(gt(servers.axrayReports, 0))
    .orderBy(desc(servers.axrayReports))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as Kind,
    displayName: r.displayName,
    reports: r.reports,
    hasIntelligence: r.reports >= K_FLOOR,
  }));
}
export const getAxrayReportedServers = cached(_getAxrayReportedServers, ["getAxrayReportedServers"], {
  revalidate: 600,
});

export { K_FLOOR };
