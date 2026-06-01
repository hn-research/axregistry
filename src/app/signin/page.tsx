/**
 * Sign-in screen. Lists every configured OAuth provider. After a successful
 * sign-in the visitor lands back where they came from (?from=…) or the
 * dashboard. Signing in only gates *saved state* — all public data stays open.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, authConfigured, githubConfigured } from "@/auth";
import { AuthButtons } from "@/components/AuthButtons";

export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  // Only honor same-site relative paths as a redirect target.
  const redirectTo = from && from.startsWith("/") ? from : "/dashboard";

  const session = await auth();
  if (session?.user) redirect(redirectTo);

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_0_18px_rgba(129,140,248,0.5)]" />
      <h1 className="mt-6 text-2xl font-semibold text-white">Sign in to ax-registry</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Save servers to a watchlist, keep your stack scans, and claim the servers
        you maintain. All public data stays open — sign-in only adds your own
        saved state.
      </p>

      <div className="mt-8 w-full text-left">
        {authConfigured ? (
          <AuthButtons redirectTo={redirectTo} />
        ) : (
          <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-zinc-400">
            Sign-in isn&rsquo;t configured on this deployment yet.
          </p>
        )}
      </div>

      {authConfigured && !githubConfigured && (
        <p className="mt-4 text-xs text-zinc-500">
          Claiming a server needs a GitHub account; GitHub sign-in isn&rsquo;t
          enabled here yet.
        </p>
      )}

      <p className="mt-8 text-xs text-zinc-500">
        By signing in you agree this is public-signal data.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How it&rsquo;s computed
        </Link>
        .
      </p>
    </main>
  );
}
