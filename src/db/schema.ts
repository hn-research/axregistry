/**
 * ax-registry catalog schema.
 *
 * Mirrors REGISTRY-DESIGN.md:
 *   §2  three data layers, never blended:
 *         - static-seeded   → `servers` + `serverVersions`   (public sources)
 *         - author-declared → `authorDeclarations`           (claimed page)
 *         - community       → `aggregates`                   (v2, k-floored; reserved)
 *   §11.1 layered canonical identity with aliases + merge:
 *         - `servers.id` is the canonical id (npm:… / oci:… / pypi:… / repo:… /
 *           remote:… / cmd:sha256…), precedence-resolved.
 *         - `serverAliases` maps every lower-precedence id to the canonical row,
 *           so records merge as more signal arrives.
 *
 * Privacy floor (§10) lives in code, not schema: nothing here stores a path,
 * secret, config value, machine id, or user identity. The cmd: id is a hash of
 * normalized argv + env *key names* only.
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Identity kinds, highest precedence first (§11.1). */
export const serverKind = pgEnum("server_kind", [
  "npm",
  "oci",
  "pypi",
  "repo",
  "remote",
  "cmd",
]);

/**
 * One row per server (the canonical identity). Carries the latest
 * static-seeded snapshot — the "static" band. Author-band and community-band
 * data live in their own tables and are never folded in here.
 */
export const servers = pgTable("servers", {
  /** Canonical id, e.g. "npm:@modelcontextprotocol/server-filesystem". */
  id: text("id").primaryKey(),
  kind: serverKind("kind").notNull(),

  // --- static-seeded display + provenance (public sources only) ---
  displayName: text("display_name").notNull(),
  description: text("description"),
  homepage: text("homepage"),
  repoUrl: text("repo_url"),
  latestVersion: text("latest_version"),
  license: text("license"),

  // --- static-seeded signals (re-verifiable from public sources) ---
  weeklyDownloads: integer("weekly_downloads"),
  stars: integer("stars"),
  hasSecurityMd: boolean("has_security_md"),

  // --- author claim (gate to the author-declared band, §2) ---
  /** Verified owner handle, e.g. "github:octocat" / "npm:octocat". Null = unclaimed. */
  claimedBy: text("claimed_by"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),

  // --- bookkeeping ---
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastStaticRefresh: timestamp("last_static_refresh", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Lower-precedence ids that resolve to a canonical server (§11.1). When a
 * later source proves two ids are the same server (npm `repository` links
 * npm:↔repo:, an OCI label links oci:↔repo:), the record merges and the
 * weaker id is recorded here as an alias.
 */
export const serverAliases = pgTable("server_aliases", {
  /** The aliased id (e.g. "repo:github.com/owner/name"). */
  alias: text("alias").primaryKey(),
  serverId: text("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  kind: serverKind("kind").notNull(),
  linkedAt: timestamp("linked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-version static facts. Powers the version-history / pinning / drift views
 * and the declared (manifest) side of the tool-surface diff (§6.3).
 */
export const serverVersions = pgTable(
  "server_versions",
  {
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Hash of the declared tool surface (manifest) for this version. */
    manifestToolsHash: text("manifest_tools_hash"),
    toolCount: integer("tool_count"),
    /** Raw declared tool list (names + description hashes only — never bodies). */
    declaredTools: jsonb("declared_tools"),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.version] })],
);

/**
 * The author-declared band (§2). One row per *claimed* server. Authors add
 * safer-mode flags, intended scopes, and recommended config — context, not a
 * verdict. Displayed as its own band, never merged into static facts.
 */
export const authorDeclarations = pgTable("author_declarations", {
  serverId: text("server_id")
    .primaryKey()
    .references(() => servers.id, { onDelete: "cascade" }),
  saferModeFlags: jsonb("safer_mode_flags"),
  intendedScopes: jsonb("intended_scopes"),
  recommendedConfig: jsonb("recommended_config"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * The community-observed band (§2, §5) — RESERVED for v2. No contribution
 * path ships in v1, so this stays empty. Created now so the v2 migration is
 * additive, not a reshape. Every figure here is k-anonymity floored (§5, §10):
 * nothing is exposed below `contributorCount >= k`.
 */
export const aggregates = pgTable("aggregates", {
  serverId: text("server_id")
    .primaryKey()
    .references(() => servers.id, { onDelete: "cascade" }),
  /** Distinct contributors behind this aggregate. Below k → render "not enough signal yet". */
  contributorCount: integer("contributor_count").notNull().default(0),
  /** Map of finding-id → corroborated count (IDs that fired, never evidence). */
  findingsHistogram: jsonb("findings_histogram"),
  /** version → share of observed population. */
  versionSplit: jsonb("version_split"),
  /** Hash of the most-observed live tool surface, for declared-vs-observed drift. */
  observedToolSurfaceHash: text("observed_tool_surface_hash"),
  lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
});

/**
 * Demand-side discovery (consumer-config crawl). A `consumer` is a PUBLIC
 * repository (an agentic app, dev environment, or project) that committed an
 * MCP client config referencing one or more servers. Public data only.
 *
 * `listOptOut` honors a do-not-list signal: the edge is still counted (so the
 * adoption proxy and co-occurrence graph stay correct), but the repo is never
 * named on a server page (§ aggregate + opt-out display).
 */
export const consumers = pgTable("consumers", {
  /** Canonical repo id, e.g. "repo:github.com/owner/name". */
  id: text("id").primaryKey(),
  host: text("host").notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  stars: integer("stars"),
  listOptOut: boolean("list_opt_out").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
});

/**
 * The usage edge: a consumer repo references a server in a committed config.
 * One row per (consumer, server, config file) so a repo that wires the same
 * server in two files counts both placements honestly.
 *
 * Privacy (§10, extended to public data): we store the server reference, the
 * client/host, the config path, and the env *key names* — never an env value
 * or a secret-looking arg. We are not a secret scraper.
 */
export const usages = pgTable(
  "usages",
  {
    consumerId: text("consumer_id")
      .notNull()
      .references(() => consumers.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    /** Config path within the repo, e.g. ".cursor/mcp.json". */
    configPath: text("config_path").notNull(),
    /** Originating client/host: claude-desktop / cursor / vscode / claude-code / continue / cline / unknown. */
    client: text("client").notNull(),
    transport: text("transport"),
    /** Sorted env key NAMES referenced for this server (never values). */
    envKeys: jsonb("env_keys"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.consumerId, t.serverId, t.configPath] })],
);

export type Consumer = typeof consumers.$inferSelect;
export type Usage = typeof usages.$inferSelect;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type ServerAlias = typeof serverAliases.$inferSelect;
export type ServerVersion = typeof serverVersions.$inferSelect;
export type AuthorDeclaration = typeof authorDeclarations.$inferSelect;
export type Aggregate = typeof aggregates.$inferSelect;
