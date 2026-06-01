/**
 * Catalog writes — turns static-source facts into canonical catalog rows,
 * applying the §11.1 identity model: the npm id is canonical, the repo id is
 * recorded as an alias so a later repo-first discovery merges into the same
 * row instead of duplicating it.
 *
 * Only the static-seeded band is written here. Author and community bands have
 * their own tables and are never folded into `servers`.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { serverAliases, servers, serverVersions } from "../db/schema";
import { npmId, pypiId, repoId, type CanonicalId } from "./identity";
import type { NpmFacts } from "./sources/npm";
import type { PypiFacts } from "./sources/pypi";
import type { GitHubFacts } from "./sources/github";

export async function upsertFromNpm(
  npm: NpmFacts,
  gh?: GitHubFacts,
): Promise<{ id: string; repoAlias?: string }> {
  const canonical = npmId(npm.name);
  const repo = npm.repositoryUrl
    ? repoId(npm.repositoryUrl, npm.repositoryDir)
    : undefined;
  const now = new Date();

  await db
    .insert(servers)
    .values({
      id: canonical.id,
      kind: "npm",
      displayName: npm.name,
      description: npm.description ?? gh?.description ?? null,
      homepage: npm.homepage ?? gh?.homepage ?? null,
      repoUrl: npm.repositoryUrl ?? null,
      latestVersion: npm.latest ?? null,
      license: npm.license ?? null,
      weeklyDownloads: npm.weeklyDownloads ?? null,
      stars: gh?.stars ?? null,
      hasSecurityMd: gh?.hasSecurityMd ?? null,
      lastStaticRefresh: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: servers.id,
      set: {
        displayName: npm.name,
        description: sql`coalesce(${npm.description ?? gh?.description ?? null}, ${servers.description})`,
        homepage: npm.homepage ?? gh?.homepage ?? null,
        repoUrl: npm.repositoryUrl ?? null,
        latestVersion: npm.latest ?? null,
        license: npm.license ?? null,
        weeklyDownloads: npm.weeklyDownloads ?? null,
        stars: gh?.stars ?? null,
        hasSecurityMd: gh?.hasSecurityMd ?? null,
        lastStaticRefresh: now,
        updatedAt: now,
      },
    });

  if (repo) {
    await db
      .insert(serverAliases)
      .values({ alias: repo.id, serverId: canonical.id, kind: "repo" })
      .onConflictDoNothing();
  }

  if (npm.versions.length) {
    await db
      .insert(serverVersions)
      .values(
        npm.versions.map((v) => ({
          serverId: canonical.id,
          version: v.version,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
        })),
      )
      .onConflictDoNothing();
  }

  return { id: canonical.id, repoAlias: repo?.id };
}

/** Upsert a PyPI server (kind pypi), recording its repo as an alias. */
export async function upsertFromPypi(
  py: PypiFacts,
  gh?: GitHubFacts,
): Promise<{ id: string; repoAlias?: string }> {
  const canonical = pypiId(py.name);
  const repo = py.repositoryUrl ? repoId(py.repositoryUrl) : undefined;
  const now = new Date();

  const set = {
    displayName: py.name,
    description: sql`coalesce(${py.summary ?? gh?.description ?? null}, ${servers.description})`,
    homepage: py.homepage ?? gh?.homepage ?? null,
    repoUrl: py.repositoryUrl ?? null,
    latestVersion: py.version ?? null,
    license: py.license ?? null,
    weeklyDownloads: py.weeklyDownloads ?? null,
    stars: gh?.stars ?? null,
    hasSecurityMd: gh?.hasSecurityMd ?? null,
    lastStaticRefresh: now,
    updatedAt: now,
  };

  await db
    .insert(servers)
    .values({ id: canonical.id, kind: "pypi", ...set, description: py.summary ?? gh?.description ?? null })
    .onConflictDoUpdate({ target: servers.id, set });

  if (repo) {
    await db
      .insert(serverAliases)
      .values({ alias: repo.id, serverId: canonical.id, kind: "repo" })
      .onConflictDoNothing();
  }

  return { id: canonical.id, repoAlias: repo?.id };
}

export interface RepoServerFacts {
  displayName: string;
  description?: string;
  homepage?: string;
  repoUrl: string;
  stars?: number;
  license?: string;
}

/**
 * Upsert a `repo:` server discovered directly (e.g. by GitHub topic). Skips if
 * the repo id is already an alias of a more authoritative server (npm/oci/pypi)
 * so we never split one project across two rows.
 */
export async function upsertRepoServer(
  repo: CanonicalId,
  facts: RepoServerFacts,
): Promise<"created" | "skipped"> {
  const [aliased] = await db
    .select({ s: serverAliases.serverId })
    .from(serverAliases)
    .where(eq(serverAliases.alias, repo.id))
    .limit(1);
  if (aliased) return "skipped";

  const now = new Date();
  const set = {
    displayName: facts.displayName,
    description: sql`coalesce(${facts.description ?? null}, ${servers.description})`,
    homepage: facts.homepage ?? null,
    repoUrl: facts.repoUrl,
    license: facts.license ?? null,
    stars: facts.stars ?? null,
    lastStaticRefresh: now,
    updatedAt: now,
  };
  await db
    .insert(servers)
    .values({ id: repo.id, kind: "repo", ...set, description: facts.description ?? null })
    .onConflictDoUpdate({ target: servers.id, set });
  return "created";
}
