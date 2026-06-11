import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://axregistry.vercel.app";

/**
 * Allow crawling the public catalog (now ISR-cached, so it's cheap), but keep
 * bots off the dynamic/private/non-indexable routes that cost a function
 * invocation per hit and have nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/scan", "/claim", "/signin", "/compare"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
