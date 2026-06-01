"use client";

/**
 * Follow / unfollow a server. Signed-in users get an optimistic toggle backed
 * by the `toggleWatch` server action; signed-out visitors get a link to sign in
 * (carrying a return path back to this server). The button is the same shape in
 * both states so the layout never shifts.
 */

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleWatch } from "@/lib/account-actions";

export function WatchButton({
  serverId,
  initialWatched,
  signedIn,
  returnPath,
}: {
  serverId: string;
  initialWatched: boolean;
  signedIn: boolean;
  returnPath: string;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/signin?from=${encodeURIComponent(returnPath)}`)}
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
            await toggleWatch(serverId, returnPath);
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
