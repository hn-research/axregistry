"use client";

/**
 * Auth controls for the site nav — now a CLIENT component using useSession, so
 * the root layout no longer calls server `auth()` (which forced every route
 * dynamic and blocked ISR/caching). `authConfigured` is passed from the server
 * layout since the client can't read auth env vars.
 */

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function NavAuth({ authConfigured }: { authConfigured: boolean }) {
  const { data: session, status } = useSession();

  // Login not wired up (no OAuth creds): keep the nav clean.
  if (!authConfigured) return null;

  // Reserve space while the session resolves to avoid layout shift.
  if (status === "loading") {
    return <span className="inline-block h-6 w-16" aria-hidden />;
  }

  const user = session?.user;
  if (!user) {
    return (
      <Link
        href="/signin"
        className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  const label = user.githubLogin ?? user.name ?? "account";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5"
        title="Your dashboard"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={label}
            className="h-6 w-6 rounded-full ring-1 ring-white/15"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs text-zinc-300">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden text-zinc-300 sm:inline">{label}</span>
      </Link>
      <button
        type="button"
        onClick={() => signOut()}
        className="rounded-md px-2 py-1.5 text-zinc-500 transition-colors hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
