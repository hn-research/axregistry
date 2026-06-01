/**
 * Canonical id ⇄ URL path. SEO-friendly, human-readable paths:
 *   npm:@modelcontextprotocol/server-filesystem
 *     → /server/npm/@modelcontextprotocol/server-filesystem
 *   repo:github.com/owner/name
 *     → /server/repo/github.com/owner/name
 * The first path segment is the kind; the rest rejoin with "/" after the ":".
 */

import type { ServerKind } from "@/lib/identity";

const KINDS: ServerKind[] = ["npm", "oci", "pypi", "repo", "remote", "cmd"];

/** Build the path parts for a canonical id (each segment URL-safe). */
export function idToParts(id: string): string[] {
  const colon = id.indexOf(":");
  if (colon === -1) return [encodeURIComponent(id)];
  const kind = id.slice(0, colon);
  const rest = id.slice(colon + 1);
  return [kind, ...rest.split("/").map(encodeURIComponent)];
}

export function idToHref(id: string): string {
  return `/server/${idToParts(id).join("/")}`;
}

/** Reconstruct a canonical id from catch-all route parts. */
export function partsToId(parts: string[]): string | null {
  if (parts.length === 0) return null;
  const [kind, ...rest] = parts.map((p) => decodeURIComponent(p));
  if (!KINDS.includes(kind as ServerKind)) return null;
  return `${kind}:${rest.join("/")}`;
}
