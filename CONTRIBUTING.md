# Contributing to ax-registry

Thanks for helping build the credibility layer for MCP servers. This guide
covers setup, the checks to run, and — most importantly — the **invariants** that
keep the project honest and safe. Please skim the invariants even if you skip
everything else.

By contributing you agree your contributions are licensed under the repo's
[MIT License](LICENSE).

## Project invariants (please don't break these)

These are not style preferences — they're the credibility and privacy promises
the whole product rests on. PRs that violate them won't be merged.

### 1. Trust language

We report **observations, never verdicts**. Use: *observed*, *measured*,
*listed*, *attested by N signals*, *no SECURITY.md observed*. **Never** use
*verified*, *safe*, *trusted*, *secure*, *certified*, or similar as a claim about
a server. Every figure should trace back to *how it's computed*.

### 2. Privacy floor

We are **not** a secret scraper. Never store, log, or transmit:

- secrets, tokens, or any **env value** (store env **key names** only),
- file paths, absolute or relative,
- machine identifiers, hostnames, usernames, or any user identity,
- raw config contents beyond what the parser extracts.

The `cmd:` identity is a hash of normalized argv + sorted env **key names** only.
When in doubt, store less.

### 3. Community data is opt-in and k-floored

Community-observed aggregates (Phase 2 / ax-ray) are **opt-in only**, never
collected by background network calls, and never exposed below the k-anonymity
floor (`k ≥ 5` distinct contributors). Repos that opt out of listing are still
**counted** in aggregates but **never named**.

### 4. Differentiate by composition, not by attacking competitors

The product wins on the graph, the six-kind identity model, and demand-side
adoption — not on banners that name or disparage other tools.

## Development setup

Prerequisites: Node 20+ and a Postgres database (Neon recommended).

```bash
npm install
cp .env.example .env.local && cp .env.example .env   # set DATABASE_URL in both
npm run db:push
npm run dev
```

See the [README](README.md#quick-start) for data ingestion commands.

## Before you open a PR

Run all three and make sure they pass:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
```

- TypeScript is strict — no `any` escape hatches without good reason.
- Server Components by default; reach for `"use client"` only when you need
  interactivity. Data pages are `force-dynamic`.
- Hot aggregate reads go through `cached()` in `src/lib/cache.ts` (JSON-safe
  returns only — the data cache does **not** round-trip `Date` objects).

## Project layout

```
src/app/        routes (App Router) + API route handlers
src/components/  UI (server-rendered viz, client islands)
src/lib/        identity, queries, insights, scan, categories, reverse, cache
src/lib/sources/ external data sources (npm, pypi, github, github-code)
src/db/         Drizzle schema + client
scripts/        seed / crawl / enrich / snapshot (run with tsx)
drizzle/        generated SQL migrations
```

Good places to start:

- **New data source** → add under `src/lib/sources/`, resolve ids via
  `src/lib/identity.ts`, upsert via `src/lib/catalog.ts`, wire into `scripts/seed.ts`.
- **New config surface** for the crawler → extend `CONFIG_QUERIES` in
  `src/lib/sources/github-code.ts` and the parser in `src/lib/mcp-config.ts`.
- **New category** for leaderboards → `src/lib/categories.ts`.

## Schema changes

Edit `src/db/schema.ts`, then `npm run db:generate` to produce a migration in
`drizzle/`. `drizzle.config.ts` guards against pointing at the wrong database.
Don't hand-edit generated migrations.

## Commits & PRs

- Keep the subject line concise and imperative ("Add PyPI seed source"). Explain
  the *why* in the body when it isn't obvious.
- One logical change per PR; describe what you changed and how you verified it.
- Link the issue you're addressing.

## Reporting bugs / proposing features

Use the issue templates. For anything security-sensitive, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.
