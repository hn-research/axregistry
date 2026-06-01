"use server";

/**
 * Saved-state mutations for signed-in users: follow/unfollow a server, save or
 * delete a scan, claim or release a server you maintain. Every action requires
 * a session (redirects to /signin otherwise) and lazily upserts the user row —
 * we keep auth itself DB-free, so this is the first time a user touches the DB.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, watchlist, savedScans, servers } from "@/db/schema";
import { canClaim } from "@/lib/account";
import { idToHref } from "@/lib/serverPath";
import type { ScanReport } from "@/lib/scan";

type SessionUser = Session["user"];

async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  return session.user;
}

/** Upsert the signed-in user (first saved action records identity for display). */
async function rememberUser(user: SessionUser): Promise<void> {
  await db
    .insert(users)
    .values({
      id: user.id,
      provider: user.provider ?? "unknown",
      login: user.githubLogin ?? user.name ?? null,
      name: user.name ?? null,
      avatarUrl: user.image ?? null,
      githubLogin: user.githubLogin ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        lastSeenAt: sql`now()`,
        name: user.name ?? null,
        avatarUrl: user.image ?? null,
        githubLogin: user.githubLogin ?? null,
      },
    });
}

/** Follow or unfollow a server. `path` is revalidated so the button reflects state. */
export async function toggleWatch(serverId: string, path?: string): Promise<void> {
  const user = await requireUser();
  await rememberUser(user);

  const [existing] = await db
    .select({ x: sql`1` })
    .from(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.serverId, serverId)))
    .limit(1);

  if (existing) {
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, user.id), eq(watchlist.serverId, serverId)));
  } else {
    await db.insert(watchlist).values({ userId: user.id, serverId }).onConflictDoNothing();
  }

  if (path) revalidatePath(path);
  revalidatePath("/dashboard");
}

/** Persist a scan report snapshot, then land on the dashboard. */
export async function saveScan(report: ScanReport): Promise<void> {
  const user = await requireUser();
  await rememberUser(user);
  await db.insert(savedScans).values({
    id: randomUUID(),
    userId: user.id,
    source: report.source,
    serverCount: report.serverCount,
    knownCount: report.knownCount,
    report,
  });
  redirect("/dashboard");
}

export async function deleteSavedScan(id: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(savedScans)
    .where(and(eq(savedScans.id, id), eq(savedScans.userId, user.id)));
  revalidatePath("/dashboard");
}

/**
 * Claim a server. Requires a GitHub session and that the server's repo owner
 * matches your GitHub login. The ownership check is enforced here too (not just
 * in the UI) so the action is safe to call directly.
 */
export async function claimServer(serverId: string): Promise<void> {
  const user = await requireUser();
  if (!user.githubLogin) redirect(`/signin?from=${encodeURIComponent("/claim?server=" + serverId)}`);
  await rememberUser(user);

  const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
  if (!server) redirect("/catalog");

  // Already claimed, or not ours → just return to the page, no change.
  if (server.claimedBy || !canClaim(server, user.githubLogin)) {
    redirect(idToHref(serverId));
  }

  await db
    .update(servers)
    .set({ claimedBy: `github:${user.githubLogin}`, claimedAt: sql`now()` })
    .where(eq(servers.id, serverId));

  revalidatePath(idToHref(serverId));
  revalidatePath("/dashboard");
  redirect(`/claim?server=${encodeURIComponent(serverId)}`);
}

/** Release a claim you own. */
export async function unclaimServer(serverId: string): Promise<void> {
  const user = await requireUser();
  if (!user.githubLogin) redirect("/signin");
  await db
    .update(servers)
    .set({ claimedBy: null, claimedAt: null })
    .where(and(eq(servers.id, serverId), eq(servers.claimedBy, `github:${user.githubLogin}`)));
  revalidatePath(idToHref(serverId));
  revalidatePath("/dashboard");
}
