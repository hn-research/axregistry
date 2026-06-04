/**
 * POST /api/ingest — the ax-ray → registry intelligence loop (§5).
 *
 * Accepts an OPT-IN, anonymized findings submission from the ax-ray client and
 * records it as community-observed signal. Privacy is enforced here, not
 * trusted from the client: every field is validated/stripped to a safe shape
 * (see lib/intelligence `sanitizeServer`), so nothing but finding ids, flags,
 * grades, transports, env KEY names, and hashes can ever be stored. No secrets,
 * values, paths, machine ids, or user identity — by construction.
 *
 * Aggregates derived from these rows are exposed only at/above the k-anonymity
 * floor (k>=5); a single submission is stored but never displayed alone.
 */

import { type NextRequest, after } from "next/server";
import { recordSubmission } from "@/lib/intelligence";
import { enrichServerById } from "@/lib/enrich-one";
import { idToHref } from "@/lib/serverPath";
import { rateLimit, tooMany } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const MAX_BODY = 512 * 1024; // 512 KB — a scan payload is small

export async function POST(req: NextRequest) {
  // Rate limit FIRST, before any parsing/DB work. Submissions are infrequent.
  const rl = await rateLimit(req, { route: "ingest", limit: 30, windowSec: 3600 });
  if (!rl.ok) return tooMany(rl.retryAfter);

  // Guard body size cheaply via the header when present.
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "expected an object" }, { status: 400 });
  }
  const payload = body as {
    schema?: number;
    contributorId?: unknown;
    servers?: unknown;
  };

  if (payload.schema !== 1) {
    return Response.json({ error: "unsupported schema (expected 1)" }, { status: 400 });
  }
  const token = typeof payload.contributorId === "string" ? payload.contributorId.trim() : "";
  if (token.length < 8 || token.length > 200) {
    return Response.json({ error: "missing or invalid contributorId" }, { status: 400 });
  }
  if (!Array.isArray(payload.servers)) {
    return Response.json({ error: "servers must be an array" }, { status: 400 });
  }

  try {
    const result = await recordSubmission(token, payload.servers);

    // Newly-discovered servers: pull their public facts AFTER the response is
    // sent, so enrichment never blocks (or fails) the ingest call.
    if (result.discovered.length > 0) {
      after(async () => {
        for (const id of result.discovered) await enrichServerById(id);
      });
    }

    return Response.json({
      ok: true,
      accepted: result.accepted,
      skipped: result.skipped,
      // Echo resolved server ids + their page paths so the contributor can find them.
      servers: result.servers.map((s) => ({ ...s, url: idToHref(s.id) })),
      note: "Aggregates appear on a server's page only once 5+ contributors have reported it.",
    });
  } catch (err) {
    return Response.json(
      { error: "ingest failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
