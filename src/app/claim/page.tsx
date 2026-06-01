/**
 * Author claim (REGISTRY-DESIGN.md §2 author-declared band).
 *
 * v1 ownership proof: you may claim a server whose canonical GitHub repo is
 * under your account — we match the repo owner against your GitHub login from
 * sign-in. That unlocks the author-declared band on the server's page. No
 * contribution path here (that is v2); claiming is a public ownership proof.
 *
 * Server-aware: reached from a server page (?server=<id>) it names the target
 * and shows the right action for who you are (claim it, sign in with GitHub,
 * or why we couldn't match ownership).
 */

import Link from "next/link";
import { getServerRecord } from "@/lib/queries";
import { idToHref } from "@/lib/serverPath";
import { BadgeGallery } from "@/components/BadgeGallery";
import { auth, githubConfigured } from "@/auth";
import { canClaim, repoOwnerOf } from "@/lib/account";
import { claimServer, unclaimServer } from "@/lib/account-actions";

export const dynamic = "force-dynamic";

export default async function Claim({
  searchParams,
}: {
  searchParams: Promise<{ server?: string }>;
}) {
  const { server: serverParam } = await searchParams;
  const record = serverParam ? await getServerRecord(serverParam) : null;
  const target = record?.server ?? null;

  const session = await auth();
  const githubLogin = session?.user?.githubLogin ?? null;
  const signedIn = Boolean(session?.user?.id);

  const from = target ? `/claim?server=${encodeURIComponent(target.id)}` : "/claim";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">Claim your server</h1>
      <p className="mt-4 max-w-2xl text-zinc-400">
        Claiming proves you own the repository, and unlocks the author-declared
        band on your server&rsquo;s page: safer-mode flags, intended scopes,
        recommended config, and a badge you can paste into your README.
      </p>

      {target && (
        <div className="mt-6 max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs text-zinc-500">Claiming</p>
          <div className="mt-1">
            <Link
              href={idToHref(target.id)}
              className="break-all font-medium text-indigo-300 hover:underline"
            >
              {target.displayName}
            </Link>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{target.id}</p>
          </div>

          {/* The action that fits who you are. */}
          <div className="mt-4">
            <ClaimAction
              target={target}
              githubLogin={githubLogin}
              signedIn={signedIn}
              from={from}
            />
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-zinc-500">
              These badges already work today — claiming adds the author band on top.
            </p>
            <BadgeGallery id={target.id} />
          </div>
        </div>
      )}

      <ol className="mt-8 max-w-2xl space-y-4">
        <Step n={1} title="Prove ownership">
          Sign in with GitHub. You can claim any server whose repository is under
          your account — we match the repo owner to your GitHub login.
        </Step>
        <Step n={2} title="Add context">
          Declare safer-mode flags, intended scopes, and recommended config —
          stated intent, shown as its own band, never blended with static facts.
        </Step>
        <Step n={3} title="Embed the badge">
          Copy the Markdown snippet from your page into your README. Every badge
          links back and reflects your current signals.
        </Step>
      </ol>

      <p className="mt-8 text-sm text-zinc-500">
        Claiming is a public ownership proof, not a contribution — no data leaves
        your machine.
      </p>
    </main>
  );
}

function ClaimAction({
  target,
  githubLogin,
  signedIn,
  from,
}: {
  target: { id: string; repoUrl: string | null; claimedBy: string | null };
  githubLogin: string | null;
  signedIn: boolean;
  from: string;
}) {
  // Already claimed.
  if (target.claimedBy) {
    const mine = githubLogin && target.claimedBy === `github:${githubLogin}`;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
          Claimed by {target.claimedBy}
        </span>
        {mine && (
          <form action={unclaimServer.bind(null, target.id)}>
            <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">
              Release claim
            </button>
          </form>
        )}
      </div>
    );
  }

  // GitHub sign-in isn't even available on this deployment.
  if (!githubConfigured) {
    return (
      <p className="text-sm text-zinc-500">
        Claiming needs GitHub sign-in, which isn&rsquo;t enabled on this
        deployment yet.
      </p>
    );
  }

  // Not signed in, or signed in without a GitHub handle → send to GitHub sign-in.
  if (!signedIn || !githubLogin) {
    return (
      <Link
        href={`/signin?from=${encodeURIComponent(from)}`}
        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
      >
        {signedIn ? "Connect GitHub to claim" : "Sign in with GitHub to claim"}
      </Link>
    );
  }

  // Signed in with GitHub: either ownership matches, or it doesn't.
  if (canClaim(target, githubLogin)) {
    return (
      <form action={claimServer.bind(null, target.id)}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
        >
          Claim this server as {githubLogin}
        </button>
      </form>
    );
  }

  const owner = repoOwnerOf(target);
  return (
    <p className="text-sm text-zinc-400">
      Signed in as <strong className="text-zinc-200">{githubLogin}</strong>, but
      this server&rsquo;s repository{" "}
      {owner ? (
        <>
          is under <strong className="text-zinc-200">{owner}</strong>
        </>
      ) : (
        "isn’t a GitHub repo we can match"
      )}
      , so we can&rsquo;t verify your ownership. Claim is available to the repo
      owner.
    </p>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-zinc-200">
        {n}
      </span>
      <div>
        <h3 className="font-medium text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{children}</p>
      </div>
    </li>
  );
}
