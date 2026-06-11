import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://axregistry.vercel.app";

// Cache the sitemap for a day (it's a DB-light list of static routes for now).
export const revalidate = 86_400;

/**
 * Static routes. The ~20k per-server pages are discoverable via internal links
 * and are ISR-cached, so crawling them is cheap. A full per-server sitemap
 * (chunked via generateSitemaps over the catalog) is a follow-up if we want to
 * steer crawlers more precisely.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/catalog", "/insights", "/intelligence", "/lists", "/repos", "/org", "/developers", "/methodology"];
  return routes.map((r) => ({
    url: `${base}${r}`,
    changeFrequency: "daily" as const,
    priority: r === "" ? 1 : 0.7,
  }));
}
