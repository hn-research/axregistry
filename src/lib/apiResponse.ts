/**
 * Helpers for the public read API (/api/v1/*). Every response is CORS-open
 * (read-only public data, meant to be embedded/consumed from anywhere) and
 * cacheable at the edge. Trust-language and privacy rules still apply: we only
 * ever hand out public-signal data the rest of the site already shows.
 */

const BASE_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "public, max-age=300, s-maxage=300",
};

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: BASE_HEADERS });
}

export function apiError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: BASE_HEADERS });
}

/** Preflight handler — re-export as OPTIONS from any route that wants it. */
export function apiOptions(): Response {
  return new Response(null, { status: 204, headers: BASE_HEADERS });
}
