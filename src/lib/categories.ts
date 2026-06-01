/**
 * Category leaderboards. MCP servers carry no category in the schema, so we
 * derive one heuristically from the name + description (keyword match, most
 * specific first). This powers browsable "top servers per category" lists —
 * the BuiltWith-style "what leads each space" view — with zero schema change.
 *
 * Everything here sits on a single cached adoption-ranked fetch, so the lists
 * cost one query regardless of how many categories render.
 */

import { browseCatalog, type CatalogItem } from "@/lib/insights";
import { cached } from "@/lib/cache";

export interface Category {
  slug: string;
  label: string;
  blurb: string;
  keywords: string[];
}

/** Ordered most-specific-first; the first matching category wins. */
export const CATEGORIES: Category[] = [
  {
    slug: "version-control",
    label: "Version control",
    blurb: "Git hosts and code-collaboration servers.",
    keywords: ["github", "gitlab", "bitbucket", "gitea", "version control"],
  },
  {
    slug: "ai-ml",
    label: "AI & vector stores",
    blurb: "Model providers, embeddings, and vector databases.",
    keywords: [
      "openai", "anthropic", "llm", "embedding", "embeddings", "huggingface",
      "replicate", "vector", "pinecone", "weaviate", "qdrant", "chroma", "milvus",
      "rag", "ollama",
    ],
  },
  {
    slug: "database",
    label: "Databases",
    blurb: "Relational, document, and key-value data stores.",
    keywords: [
      "database", "postgres", "postgresql", "mysql", "sqlite", "mongodb", "mongo",
      "redis", "supabase", "prisma", "neon", "snowflake", "bigquery", "duckdb",
      "clickhouse", "cassandra", "sqlalchemy", "sql",
    ],
  },
  {
    slug: "browser-automation",
    label: "Browser & scraping",
    blurb: "Headless browsers, automation, and web scraping.",
    keywords: [
      "browser", "playwright", "puppeteer", "selenium", "chrome", "scrape",
      "scraping", "scraper", "crawl", "crawler", "fetch url",
    ],
  },
  {
    slug: "search",
    label: "Search & retrieval",
    blurb: "Web search, retrieval, and answer engines.",
    keywords: [
      "search", "brave", "perplexity", "exa", "tavily", "serp", "elastic",
      "algolia", "meilisearch", "kagi",
    ],
  },
  {
    slug: "filesystem",
    label: "Filesystem & files",
    blurb: "Local files, directories, and document access.",
    keywords: ["filesystem", "file system", "files", "directory", "pdf", "csv", "excel"],
  },
  {
    slug: "communication",
    label: "Communication",
    blurb: "Chat, email, and messaging platforms.",
    keywords: [
      "slack", "discord", "email", "gmail", "telegram", "teams", "twilio",
      "whatsapp", "matrix", "mail",
    ],
  },
  {
    slug: "cloud-devops",
    label: "Cloud & DevOps",
    blurb: "Cloud providers, containers, and infrastructure.",
    keywords: [
      "aws", "gcp", "azure", "kubernetes", "k8s", "docker", "terraform",
      "cloudflare", "vercel", "netlify", "heroku", "fly.io",
    ],
  },
  {
    slug: "productivity",
    label: "Productivity & PM",
    blurb: "Docs, project management, and team tools.",
    keywords: [
      "notion", "jira", "linear", "asana", "calendar", "todoist", "confluence",
      "trello", "airtable", "clickup", "obsidian",
    ],
  },
  {
    slug: "monitoring",
    label: "Monitoring & observability",
    blurb: "Errors, metrics, logs, and dashboards.",
    keywords: ["sentry", "datadog", "grafana", "prometheus", "logging", "observability"],
  },
  {
    slug: "payments-commerce",
    label: "Payments & commerce",
    blurb: "Payments, billing, and storefronts.",
    keywords: ["stripe", "paypal", "shopify", "square", "billing", "payment", "payments"],
  },
  {
    slug: "maps-weather",
    label: "Maps & weather",
    blurb: "Geolocation, maps, and weather data.",
    keywords: ["maps", "map", "location", "geocode", "weather", "geo"],
  },
];

const OTHER: Category = {
  slug: "other",
  label: "Everything else",
  blurb: "Servers that don't fall into a named category yet.",
  keywords: [],
};

const MATCHERS = CATEGORIES.map((c) => ({
  cat: c,
  res: c.keywords.map((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")),
}));

/** Assign one category slug from a server's name + description. */
export function categorize(displayName: string, description: string | null): string {
  const hay = `${displayName} ${description ?? ""}`;
  for (const { cat, res } of MATCHERS) {
    if (res.some((re) => re.test(hay))) return cat.slug;
  }
  return OTHER.slug;
}

export interface CategoryGroup {
  slug: string;
  label: string;
  blurb: string;
  total: number;
  servers: CatalogItem[];
}

/** All categories with their servers ranked by observed adoption. */
async function _getCategoryLeaderboards(): Promise<CategoryGroup[]> {
  const { items } = await browseCatalog({ sort: "observed", pageSize: 1000 });

  const buckets = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const slug = categorize(item.displayName, item.description);
    const arr = buckets.get(slug) ?? [];
    arr.push(item);
    buckets.set(slug, arr);
  }

  const ordered = [...CATEGORIES, OTHER];
  return ordered
    .map((c) => {
      const servers = buckets.get(c.slug) ?? [];
      // items already arrive observed-desc; keep that order.
      return { slug: c.slug, label: c.label, blurb: c.blurb, total: servers.length, servers };
    })
    .filter((g) => g.total > 0);
}

export const getCategoryLeaderboards = cached(_getCategoryLeaderboards, [
  "getCategoryLeaderboards",
]);

/** One category's full ranked list (and its metadata), or null if unknown/empty. */
export async function getCategory(slug: string): Promise<CategoryGroup | null> {
  const groups = await getCategoryLeaderboards();
  return groups.find((g) => g.slug === slug) ?? null;
}
