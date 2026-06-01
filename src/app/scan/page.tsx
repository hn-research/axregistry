/**
 * Stack scanner (REGISTRY-DESIGN.md §5.3 — the flagship "useful action"). Point
 * at a public repo or paste a config; get a credibility report on every MCP
 * server it wires up. Read-only: nothing is stored, env values are never read.
 *
 * Two entry points: ?repo=owner/name is server-rendered and shareable; the
 * paste box is a client island backed by a server action.
 */

import Link from "next/link";
import { parseRepoInput, scanRepo } from "@/lib/scan";
import { ScanReportView } from "@/components/ScanReportView";
import { SaveScanButton } from "@/components/SaveScanButton";
import { ScanForm } from "./ScanForm";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;
  const parsed = repo ? parseRepoInput(repo) : null;
  const report = parsed ? await scanRepo(parsed.owner, parsed.name) : null;

  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const returnPath = repo ? `/scan?repo=${encodeURIComponent(repo)}` : "/scan";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Scan your MCP stack</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          What MCP servers are wired into a repo or config — and what public
          signal exists for each one? Point at a public GitHub repo or paste a
          config. We resolve every server to its canonical identity and report
          what we observe. We never name a verdict, store your input, or read env
          values.
        </p>
      </header>

      {/* Repo path — shareable GET URL */}
      <form method="get" action="/scan" className="mt-5 flex flex-wrap items-end gap-3">
        <div className="grow">
          <label htmlFor="repo" className="block text-sm font-medium">
            Scan a public GitHub repo
          </label>
          <input
            id="repo"
            name="repo"
            defaultValue={repo ?? ""}
            placeholder="owner/name or https://github.com/owner/name"
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Scan repo
        </button>
        {repo && (
          <Link href="/scan" className="py-1.5 text-sm text-blue-600 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {repo && !parsed && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Couldn’t read that as a repo. Use <code>owner/name</code> or a GitHub URL.
        </p>
      )}

      {report && (
        <>
          {report.serverCount > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <p className="text-sm text-zinc-400">
                Keep this scan to revisit it and watch the signals change over time.
              </p>
              <SaveScanButton report={report} signedIn={signedIn} returnPath={returnPath} />
            </div>
          )}
          <ScanReportView report={report} />
        </>
      )}

      <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ScanForm />
      </div>

      <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Findings are observations, not endorsements — we say <em>observed</em>,{" "}
        <em>unclaimed</em>, <em>no SECURITY.md observed</em>, never <em>safe</em> or{" "}
        <em>verified</em>.{" "}
        <Link href="/methodology" className="text-blue-600 hover:underline">
          Methodology
        </Link>
        .
      </footer>
    </main>
  );
}
