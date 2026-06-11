"use client";

/**
 * Auth controls for the site nav — a CLIENT component that resolves the session
 * via a plain, try/caught fetch to /api/auth/session (NOT useSession). This keeps
 * the root layout free of server `auth()` (so pages stay ISR-cacheable) without a
 * SessionProvider context dependency that could throw and take down the client
 * tree. A failed fetch degrades to the signed-out view; it never crashes the page.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/auth-actions";

type SessionUser = { name?: string | null; image?: string | null; githubLogin?: string | null };

export function NavAuth({ authConfigured }: { authConfigured: boolean }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!authConfigured) return;
    let live = true;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        setUser(data && data.user ? data.user : null);
        setResolved(true);
      })
      .catch(() => {
        if (live) setResolved(true);
      });
    return () => {
      live = false;
    };
  }, [authConfigured]);

  if (!authConfigured) return null;

  // Before the session resolves, reserve space to avoid layout shift.
  if (!resolved) return <span className="inline-block h-6 w-16" aria-hidden />;

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
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md px-2 py-1.5 text-zinc-500 transition-colors hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
