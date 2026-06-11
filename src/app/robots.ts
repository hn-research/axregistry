import type { MetadataRoute } from "next";

const base =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "https://axregistry.vercel.app";

// AI-training + aggressive-SEO crawlers we fully disallow: they burn compute
// (each crawl = a Neon/edge hit) for little return. All of these honor robots.txt.
// Search indexers (Googlebot, Bingbot, Applebot) are deliberately NOT blocked —
// they drive discoverability and, now that pages are ISR-cached, cost ~nothing.
const BLOCKED_BOTS = [
  "GPTBot",            // OpenAI training crawler
  "OAI-SearchBot",     // OpenAI search
  "ChatGPT-User",      // ChatGPT browsing on user request
  "CCBot",             // Common Crawl (feeds many LLMs)
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",   // Gemini training (NOT Googlebot search)
  "Applebot-Extended", // Apple AI training (NOT Applebot search)
  "Bytespider",        // ByteDance, notoriously aggressive
  "Amazonbot",
  "Diffbot",
  "DataForSeoBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
];

/**
 * Allow search indexers to crawl the (now ISR-cached) catalog, keep all bots off
 * the dynamic/private routes, and fully disallow AI-training + scraper crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/scan", "/claim", "/signin", "/compare"],
      },
      ...BLOCKED_BOTS.map((bot) => ({ userAgent: bot, disallow: "/" })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
