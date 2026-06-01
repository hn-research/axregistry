/**
 * Canonical public origin for absolute links (embed cards, API examples, etc.).
 * Set NEXT_PUBLIC_SITE_URL (or SITE_URL) per deployment; defaults to the prod
 * domain. Trailing slash trimmed so callers can do `${SITE_URL}${path}`.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  "https://axregistry.com"
).replace(/\/+$/, "");
