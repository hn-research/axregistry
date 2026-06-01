/**
 * Catalog writes — turns static-source facts into canonical catalog rows,
 * applying the §11.1 identity model: the npm id is canonical, the repo id is
 * recorded as an alias so a later repo-first discovery merges into the same
 * row instead of duplicating it.
 *
 * Only the static-seeded band is written here. Author and community bands have
 * their own tables and are never folded into `servers`.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { serverAliases, servers, serverVersions } from "../db/schema";
import { npmId, repoId } from "./identity";
import type { NpmFacts } from "./sources/npm";
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
