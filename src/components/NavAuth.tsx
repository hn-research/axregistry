/**
 * Auth controls for the site nav — a server component so it can call `auth()`
 * directly (no client-side session fetch, no extra round-trip). Renders nothing
 * but a quiet "Sign in" affordance when login isn't configured or the visitor
 * is signed out; an avatar + sign-out when signed in.
 */

import { auth, authConfigured } from "@/auth";
import { signInWithGitHub, signOutAction } from "@/app/auth-actions";

export async function NavAuth() {
  // Login not wired up (no GitHub OAuth creds): show nothing, keep the nav clean.
  if (!authConfigured) return null;

  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <form action={signInWithGitHub}>
        <button
          type="submit"
          className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:text-white"
        >
          Sign in
        </button>
      </form>
    );
  }

  const label = user.githubLogin ?? user.name ?? "account";

  return (
    <div className="flex items-center gap-2">
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
