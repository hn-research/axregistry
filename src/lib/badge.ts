/**
 * Shields-style badge SVG (REGISTRY-DESIGN.md §7).
 *
 * The label honors the trust-language rule (§10.6): it states what was
 * observed/attested, never a verdict. Allowed messages:
 *   - "attested N signals"  (community band at/above k-floor)
 *   - "observed in N repos"  (public demand-side adoption — any server)
 *   - "claimed"             (author-claimed, no community yet)
 *   - "listed"              (static-seeded only)
 * Never "verified", "safe", or "trusted".
 */

export type BadgeState =
  | { kind: "attested"; signals: number }
  | { kind: "observed"; repos: number }
  | { kind: "claimed" }
  | { kind: "listed" };

const COLORS: Record<BadgeState["kind"], string> = {
  attested: "#16a34a", // green
  observed: "#0d9488", // teal
  claimed: "#2563eb", // blue
  listed: "#6b7280", // gray
};

export function badgeMessage(state: BadgeState): string {
  switch (state.kind) {
    case "attested":
      return `attested ${state.signals} signals`;
    case "observed":
      return `observed in ${state.repos} repos`;
    case "claimed":
      return "claimed";
    case "listed":
      return "listed";
  }
}

/** Approximate text width (px) at 11px Verdana — good enough for layout. */
function textWidth(s: string): number {
  return s.length * 6.5 + 10;
}

export function renderBadge(state: BadgeState): string {
  const label = "ax-ray";
  const message = badgeMessage(state);
  const color = COLORS[state.kind];

  const lw = textWidth(label);
  const mw = textWidth(message);
  const w = lw + mw;
  const lx = lw / 2;
  const mx = lw + mw / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${label}: ${message}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${mw}" height="20" fill="${color}"/>
    <rect width="${w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lx}" y="14">${label}</text>
    <text x="${mx}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${mx}" y="14">${message}</text>
  </g>
</svg>`;
}
