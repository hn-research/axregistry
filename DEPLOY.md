# Deploying ax-registry to Vercel

The app is a standard Next.js App Router project backed by Neon (external) — no
servers to run. Hosting is Vercel; ingestion runs on GitHub Actions (the crawl
is too long for serverless cron).

## 1. Import the repo into Vercel
- New Project → import the GitHub repo. Framework preset auto-detects **Next.js**.
- Build command / output: defaults (no `vercel.json` needed).
- (Pro only) set the function region to **iad1** to sit next to Neon `us-east-1`
  for lowest DB latency. On Hobby the default region is fine.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Required:
| Var | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (the `axregistry` DB) |
| `AUTH_SECRET` | `npx auth secret` (or `openssl rand -base64 33`) |
| `NEXT_PUBLIC_SITE_URL` | `https://axregistry.com` |
| `AUTH_URL` | `https://axregistry.com` |

Auth providers (add the ones you want; GitHub is the claim anchor):
| Var | From |
| --- | --- |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | a **production** GitHub OAuth app (see §3) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud credentials (optional) |
| `AUTH_GITLAB_ID` / `AUTH_GITLAB_SECRET` | GitLab application (optional) |

Cache flush (so ingestion can refresh prod instantly):
| Var | Value |
| --- | --- |
| `REVALIDATE_SECRET` | `openssl rand -hex 16` |

> The read path is cached (1h TTL) in production only — dev reads live. Don't set
> `REGISTRY_NO_CACHE` in prod.

## 3. Production OAuth app(s)
OAuth apps allow one callback URL, so register a **separate prod app** (don't
reuse the localhost one):
- **GitHub** → https://github.com/settings/developers
  - Homepage: `https://axregistry.com`
  - Callback: `https://axregistry.com/api/auth/callback/github`
- **Google** redirect URI: `https://axregistry.com/api/auth/callback/google`
- **GitLab** redirect URI: `https://axregistry.com/api/auth/callback/gitlab`

## 4. Custom domain
- Add `axregistry.com` (and `www`) under Vercel → Domains; point DNS as Vercel
  instructs. SSL is automatic.

## 5. Database
- Migrations are already applied to Neon. If deploying a fresh DB, run the
  `drizzle/*.sql` files (or `npm run db:push`) against it first.

## 6. Scheduled ingestion (GitHub Actions)
`.github/workflows/ingest.yml` runs daily. In the repo's
**Settings → Secrets and variables → Actions** add:
| Secret | Value |
| --- | --- |
| `DATABASE_URL` | same Neon string |
| `INGEST_GH_TOKEN` | a classic PAT, read-only (can't be named `GITHUB_*`) |
| `SITE_URL` | `https://axregistry.com` |
| `REVALIDATE_SECRET` | same value as the Vercel env var |

Trigger once from the Actions tab to backfill; it then runs daily and flushes
the prod cache when done.

## Notes
- Public data (npm/crawl adoption) is re-derivable and open. The community
  intelligence dataset (ax-ray findings, Phase 2) stays proprietary — served
  only through the hosted product/API, never published raw.
