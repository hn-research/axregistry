/**
 * Your dashboard — the signed-in home. Three sections, each backed by a
 * saved-state feature: servers you watch (with live adoption), scans you saved,
 * and servers you've claimed. This is the tangible payoff of signing in.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getWatchlist, getSavedScans, getClaimedServers } from "@/lib/account";
import { toggleWatch, deleteSavedScan, unclaimServer } from "@/lib/account-actions";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";
import type { ScanReport } from "@/lib/scan";

export const dynamic = "force-dynamic";

function relTime(d: Date | null): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?from=/dashboard");
  const user = session.user;

  const [watched, scans, claimed] = await Promise.all([
    getWatchlist(user.id),
    getSavedScans(user.id),
    user.githubLogin ? getClaimedServers(user.githubLogin) : Promise.resolve([]),
  ]);

  const name = user.githubLogin ?? user.name ?? "there";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="flex items-center gap-4 border-b border-white/10 pb-6">
        {user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-12 w-12 rounded-full ring-1 ring-white/15" />
        )}
        <div>
          <h1 className="text-2xl font-semibold text-white">Welcome back, {name}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {watched.length} watched · {scans.length} saved {scans.length === 1 ? "scan" : "scans"} ·{" "}
            {claimed.length} claimed
          </p>
        </div>
      </header>

      {/* Watchlist */}
      <Section
        title="Watching"
        note="Servers you follow, newest first — with live adoption."
        cta={{ href: "/catalog?sort=observed", label: "Find servers to watch →" }}
      >
        {watched.length === 0 ? (
          <Empty>
            You aren&rsquo;t watching any servers yet. Open any{" "}
            <Link href="/catalog" className="text-indigo-300 hover:underline">
              server page
            </Link>{" "}
            and hit <span className="text-zinc-300">Watch</span>.
          </Empty>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {watched.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]">
                <Link href={idToHref(s.id)} className="flex min-w-0 items-center gap-2">
                  <KindChip kind={s.kind} />
                  <span className="truncate font-medium text-zinc-100">{s.displayName}</span>
                  {s.claimed && (
                    <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
                      claimed
                    </span>
                  )}
                </Link>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-sm tabular-nums text-zinc-400">
                    {s.observedRepos > 0 ? `${s.observedRepos.toLocaleString()} repos` : "—"}
                  </span>
                  <form action={toggleWatch.bind(null, s.id, "/dashboard")}>
                    <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">
                      Unfollow
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Saved scans */}
      <Section
        title="Saved scans"
        note="Snapshots of stacks you scanned — revisit and re-run them."
        cta={{ href: "/scan", label: "Scan a stack →" }}
      >
        {scans.length === 0 ? (
          <Empty>
            No saved scans yet.{" "}
            <Link href="/scan" className="text-indigo-300 hover:underline">
              Scan a repo or config
            </Link>{" "}
            and save the report.
          </Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {scans.map((scan) => {
              const report = scan.report as ScanReport;
              const names = report.servers?.slice(0, 4).map((x) => x.displayName) ?? [];
              return (
                <li key={scan.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium text-zinc-100">{scan.source}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{relTime(scan.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {scan.knownCount}/{scan.serverCount} servers known to the registry
                  </p>
                  {names.length > 0 && (
                    <p className="mt-2 truncate text-xs text-zinc-400">{names.join(" · ")}</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    {REPO_RE.test(scan.source) && (
                      <Link
                        href={`/scan?repo=${encodeURIComponent(scan.source)}`}
                        className="text-indigo-300 hover:underline"
                      >
                        Re-scan →
                      </Link>
                    )}
                    <form action={deleteSavedScan.bind(null, scan.id)}>
                      <button type="submit" className="text-zinc-500 hover:text-zinc-300">
                        Delete
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Claimed */}
      <Section
        title="Claimed servers"
        note="Servers you maintain — claim adds the author-declared band."
        cta={{ href: "/claim", label: "Claim a server →" }}
      >
        {!user.githubLogin ? (
          <Empty>
            Claiming needs GitHub. You&rsquo;re signed in with{" "}
            <span className="text-zinc-300">{user.provider ?? "another provider"}</span> — sign in
            with GitHub to claim servers you maintain.
          </Empty>
        ) : claimed.length === 0 ? (
          <Empty>
            You haven&rsquo;t claimed any servers. Open a server you maintain and{" "}
            <Link href="/claim" className="text-indigo-300 hover:underline">
              claim it
            </Link>
            .
          </Empty>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {claimed.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]">
                <Link href={idToHref(s.id)} className="flex min-w-0 items-center gap-2">
                  <KindChip kind={s.kind} />
                  <span className="truncate font-medium text-zinc-100">{s.displayName}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-xs text-zinc-500">claimed {relTime(s.claimedAt)}</span>
                  <form action={unclaimServer.bind(null, s.id)}>
                    <button type="submit" className="text-xs text-zinc-500 hover:text-zinc-300">
                      Release
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  note,
  cta,
  children,
}: {
  title: string;
  note: string;
  cta: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">{note}</p>
        </div>
        <Link href={cta.href} className="shrink-0 text-sm text-indigo-300 hover:underline">
          {cta.label}
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}
