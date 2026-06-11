"use client";

/**
 * Follow / unfollow a server. Now fully client-driven so the host page can be
 * statically/ISR rendered: signed-in state comes from useSession, and the
 * watch-state is fetched client-side from /api/account/watch-state. Crawlers
 * (no JS) never trigger either, so server pages stay cheap static HTML.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toggleWatch } from "@/lib/account-actions";

export function WatchButton({ serverId }: { serverId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [watched, setWatched] = useState(false);
  const [pending, startTransition] = useTransition();

  // Pull the current watch-state once we know the visitor is signed in.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetch(`/api/account/watch-state?serverId=${encodeURIComponent(serverId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d) setWatched(Boolean(d.watched));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn, serverId]);

  // While the session resolves, keep the button shape stable.
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-400">
        <Star filled={false} />
        Watch
      </span>
    );
  }

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/signin?from=${encodeURIComponent(pathname)}`)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        <Star filled={false} />
        Watch
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setWatched((w) => !w); // optimistic
        startTransition(async () => {
          try {
            await toggleWatch(serverId, pathname);
          } catch {
            setWatched((w) => !w); // revert on failure
          }
        });
      }}
      aria-pressed={watched}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        watched
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
          : "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
      }`}
    >
      <Star filled={watched} />
      {watched ? "Watching" : "Watch"}
    </button>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6L12 17.8 6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
    </svg>
  );
}
