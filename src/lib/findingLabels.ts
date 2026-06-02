/**
 * Human labels for ax-ray finding/flag ids, so the community-observed section
 * reads for people who've never run ax-ray. Mirrors ax-ray's check catalog
 * (its `--verbose` SCAN COVERAGE list) — kept here as a small static lookup so
 * the registry needs no ax-ray dependency. If ax-ray adds a check, add its id
 * here; an unknown id just falls back to the raw id, so nothing breaks.
 *
 * Source of truth: ax-ray `src/cli.ts` CHECK_CATALOG.
 */

export const FINDING_LABELS: Record<string, string> = {
  // Static MCP-server findings
  S1: "secrets in env/args · world-readable config",
  S2: "over-broad filesystem root",
  S3: "dangerous launch (shells · sudo · docker host-mounts)",
  S4: "supply-chain risk (unpinned / non-registry source)",
  S5: "insecure remote (plaintext http · raw IP)",
  S6: "publisher security manifest absent",
  S7: "on the vendor blocklist",
  // Positive flags (MCP)
  P1: "source repo resolves to a known forge",
  P2: "broad adoption (npm downloads band)",
  P3: "version pinned + current",
  P4: "clean tool surface (deep mode)",
  P5: "filesystem scope narrow",
  P7: "DXT directory-installed (hash-recorded)",
  // Deep checks (require --connect)
  D1: "tool-description poisoning (exfil / injection / hidden unicode)",
  D2: "dangerous capability surface (exec / fs-write / network / credentials)",
  D3: "over-permissive tool inputs (unbounded command / sql / path)",
  // Agent-client capability findings
  C1: "lifecycle hooks configured",
  C2: "permissive tool allowlists (Bash / globs / Read(*))",
  C3: "broad additionalDirectories grants",
  C4: "project-shipped permissions or hooks",
  C5: "apiKeyHelper command visibility",
  C6: "enableAllProjectMcpServers auto-trust",
  CC1: "agent instruction-file content (rules)",
  CC2: "inline API key in client settings",
  // Positive flags (capabilities)
  CP1: "no hooks / no permission grants",
  CP2: "config file is owner-only",
};

/** A short human label for a finding id, or the id itself if unknown. */
export function findingLabel(id: string): string {
  return FINDING_LABELS[id] ?? id;
}

/** Whether an id is a positive flag (P / CP ids) vs a risk finding (S / D / C / CC ids). */
export function isPositiveFlag(id: string): boolean {
  return /^C?P\d/.test(id);
}
