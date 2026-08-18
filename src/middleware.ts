import { NextRequest, NextResponse } from "next/server";

/**
 * Edge bot shield. Runs BEFORE any page/route function, so a blocked request never
 * spins up a serverless function or hits Neon — this is what stops a crawl from
 * burning Fluid CPU + Function Invocations (the overage that paused the account).
 *
 * robots.txt only *asks* crawlers to stay away; bad bots ignore it. This ENFORCES.
 * Real search indexers (Googlebot / Bingbot / Applebot / DuckDuckBot) and social
 * link-preview crawlers are intentionally allowed — they aid discoverability and,
 * with pages cached, cost ~nothing. Volumetric rate-limiting is handled by the
 * Vercel Firewall (Bot Protection), which this complements at the UA layer.
 */

// Matched case-insensitively as substrings of the User-Agent.
const BLOCKED_UA = [
  // AI-training / AI-search crawlers
  "gptbot", "oai-searchbot", "chatgpt-user", "ccbot", "claudebot", "anthropic-ai",
  "claude-web", "perplexitybot", "google-extended", "applebot-extended",
  "bytespider", "bytedance", "amazonbot", "diffbot", "imagesiftbot",
  "meta-externalagent",
  // Aggressive SEO / backlink scrapers
  "dataforseobot", "ahrefsbot", "semrushbot", "mj12bot", "dotbot", "petalbot",
  "blexbot", "seokicks", "zoominfobot", "serpstatbot",
  // Generic HTTP clients / scraping libraries (the scripted crawl traffic)
  "python-requests", "python-httpx", "aiohttp", "scrapy", "go-http-client",
  "node-fetch", "axios", "libwww-perl", "okhttp", "java/", "jakarta",
  "curl/", "wget", "httpclient", "headlesschrome", "phantomjs", "puppeteer",
];

export function middleware(req: NextRequest) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();

  // No User-Agent at all → almost always a script hitting us directly.
  if (!ua) return forbidden();

  // Known bad bot or generic HTTP client → block at the edge.
  if (BLOCKED_UA.some((b) => ua.includes(b))) return forbidden();

  return NextResponse.next();
}

function forbidden() {
  // Cache the 403 so repeat offenders are served from the edge, not re-evaluated.
  return new NextResponse("Forbidden", {
    status: 403,
    headers: { "cache-control": "public, max-age=86400", "x-blocked-by": "edge-bot-shield" },
  });
}

export const config = {
  // Everything except Next internals and static asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$).*)",
  ],
};
