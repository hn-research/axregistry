"use client";

/**
 * Follow / unfollow a server. Fully client-driven so the host page stays ISR-
 * cached: it resolves BOTH signed-in state and watch-state from one plain,
 * try/caught fetch to /api/account/watch-state (no useSession / SessionProvider).
 * Crawlers (no JS) never call it, so server pages serve as cheap cached HTML.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toggleWatch } from "@/lib/account-actions";

export function WatchButton({ serverId }: { serverId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [watched, setWatched] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    fetch(`/api/account/watch-state?serverId=${encodeURIComponent(serverId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d) {
          setSignedIn(Boolean(d.signedIn));
          setWatched(Boolean(d.watched));
        }
        setResolved(true);
      })
      .catch(() => {
        if (live) setResolved(true);
      });
    return () => {
      live = false;
    };
  }, [serverId]);

  // While resolving, keep a stable button shape.
  if (!resolved) {
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
