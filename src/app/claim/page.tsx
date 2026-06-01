/**
 * Author claim — entry point (REGISTRY-DESIGN.md §2 author-declared band).
 *
 * v1: prove npm/GitHub ownership → unlock the author-declared band. No
 * contribution path here (that is v2). This page is the explainer; the
 * verification flow is wired in a follow-up.
 *
 * Server-aware: when reached from a server page (?server=<id>), it names the
 * targeted server and previews the badges that claiming unlocks.
 */

import Link from "next/link";
import { getServerRecord } from "@/lib/queries";
import { idToHref } from "@/lib/serverPath";
import { BadgeGallery } from "@/components/BadgeGallery";

export const dynamic = "force-dynamic";

export default async function Claim({
  searchParams,
}: {
  searchParams: Promise<{ server?: string }>;
}) {
  const { server: serverParam } = await searchParams;
  const record = serverParam ? await getServerRecord(serverParam) : null;
  const target = record?.server ?? null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Claim your server</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Claiming proves you own the package or repository, and unlocks the
        author-declared band on your server&rsquo;s page: safer-mode flags,
        intended scopes, recommended config, and a badge you can paste into your
        README.
      </p>

      {target && (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Claiming</p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <Link href={idToHref(target.id)} className="font-medium text-blue-600 hover:underline">
              {target.displayName}
            </Link>
            <span className="font-mono text-xs text-zinc-400">{target.id}</span>
          </div>
          {target.claimedBy ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
              Already claimed by {target.claimedBy}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              These badges already work today — claiming adds the author band on
              top.
            </p>
          )}
          <BadgeGallery id={target.id} />
        </div>
      )}

      <ol className="mt-6 space-y-4">
        <Step n={1} title="Prove ownership">
          For an npm package, we verify against the maintainer list on the
          npm registry. For a repository, we verify via GitHub.
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
        Verification flow coming online. No data leaves your machine to claim —
        claiming is a public ownership proof, not a contribution.
      </p>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium dark:bg-zinc-800">
        {n}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
      </div>
    </li>
  );
}
