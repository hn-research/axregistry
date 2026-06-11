/**
 * GET /api/account/watch-state?serverId=...
 *
 * Tiny per-user endpoint the (now static) server page's WatchButton calls
 * client-side to learn whether the signed-in visitor watches this server.
 * Dynamic + private (reads the session) — but only invoked by signed-in
 * browsers running JS, so crawlers never hit it.
 */

import { auth } from "@/auth";
import { isWatched } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const serverId = new URL(req.url).searchParams.get("serverId");

  if (!userId || !serverId) {
    return Response.json(
      { signedIn: Boolean(userId), watched: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const watched = await isWatched(userId, serverId);
  return Response.json(
    { signedIn: true, watched },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
