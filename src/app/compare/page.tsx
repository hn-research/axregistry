/**
 * Side-by-side server comparison (REGISTRY-DESIGN.md §5.3 — decision support).
 * Shareable: the comparison set lives entirely in ?ids=, so any view is a URL
 * you can paste. Add servers by canonical id or name; the recommendation strip
 * below surfaces what repos with a similar stack also wire up.
 *
 * Trust-language (§10.6): every cell is an observation — adoption, stars,
 * SECURITY.md presence — never a score, grade, or "safe/verified" verdict.
 */

import Link from "next/link";
import { resolveCanonicalId } from "@/lib/queries";
import {
  getComparison,
  recommendForStack,
  type ComparedServer,
} from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";
import { ServerSearch } from "@/components/ServerSearch";
import { KIND_FILL } from "@/lib/kindStyle";

export const dynamic = "force-dynamic";

const MAX = 4;

function relRelease(days: number | null): string {
  if (days === null) return "—";
  if (days < 30) return "this month";
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y+ ago`;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const raw = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  // Canonicalize everything (aliases → canonical), dedupe, cap at MAX.
  const resolved: string[] = [];
  for (const entry of raw) {
    const id = await resolveCanonicalId(entry);
    if (id && !resolved.includes(id)) resolved.push(id);
  }
  const ids = resolved.slice(0, MAX);

  const [servers, recs] = await Promise.all([
    getComparison(ids),
    recommendForStack(ids, 6),
  ]);

  const idsParam = (list: string[]) => list.join(",");
  const withoutHref = (id: string) =>
    `/compare?ids=${encodeURIComponent(idsParam(ids.filter((x) => x !== id)))}`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Compare servers</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Put up to {MAX} servers side by side on the public signals we hold —
          adoption, stars, releases, SECURITY.md. Every cell is observed, not
          scored. Share the URL to share the comparison.
        </p>
      </header>

      {/* Interactive add — search-as-you-type; the current set rides in ?ids= */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="grow">
          <ServerSearch currentIds={ids} max={MAX} />
        </div>
        {ids.length > 0 && (
          <Link href="/compare" className="py-1.5 text-sm text-blue-600 hover:underline">
            Clear
          </Link>
        )}
      </div>

      {servers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="w-32 border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-400 dark:border-zinc-800" />
                {servers.map((s) => (
                  <th
                    key={s.id}
                    className="min-w-[10rem] border-b border-zinc-200 px-3 py-2 text-left align-top dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={idToHref(s.id)} className="font-medium text-blue-600 hover:underline">
                        {s.displayName}
                      </Link>
                      <Link
                        href={withoutHref(s.id)}
                        className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        aria-label={`Remove ${s.displayName}`}
                      >
                        ×
                      </Link>
                    </div>
                    <div className="mt-1">
                      <KindChip kind={s.kind} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Adoption" servers={servers} cell={adoptionCell} />
              <Row label="GitHub stars" servers={servers} cell={(s) => fmt(s.stars)} />
              <Row label="Downloads/wk" servers={servers} cell={(s) => fmt(s.weeklyDownloads)} />
              <Row label="Latest version" servers={servers} cell={(s) => s.latestVersion ?? "—"} />
              <Row label="Last release" servers={servers} cell={(s) => relRelease(s.lastReleaseDays)} />
              <Row label="SECURITY.md" servers={servers} cell={securityCell} />
              <Row label="License" servers={servers} cell={(s) => s.license ?? "—"} />
              <Row label="Claimed" servers={servers} cell={(s) => (s.claimed ? "yes" : "no")} />
              <Row label="Links" servers={servers} cell={linksCell} />
            </tbody>
          </table>
        </div>
      )}

      {recs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Repos with a similar stack also wire up</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recs.map((r) => (
              <li key={r.id} className="inline-flex items-center gap-1.5">
                <Link
                  href={`/compare?ids=${encodeURIComponent(idsParam([...ids, r.id]))}`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                  title="Add to comparison"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: KIND_FILL[r.kind] }}
                    aria-hidden
                  />
                  <span className="truncate">{r.displayName}</span>
                  <span className="text-xs text-zinc-400">+{r.repos}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            Co-occurrence across public repos — click to add to the comparison.
          </p>
        </section>
      )}

      <footer className="mt-10 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        Observed public signal — never a grade or endorsement.{" "}
        <Link href="/methodology" className="text-blue-600 hover:underline">
          Methodology
        </Link>
        .
      </footer>
    </main>
  );
}

function Row({
  label,
  servers,
  cell,
}: {
  label: string;
  servers: ComparedServer[];
  cell: (s: ComparedServer) => React.ReactNode;
}) {
  return (
    <tr>
      <th className="border-b border-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800/70">
        {label}
      </th>
      {servers.map((s) => (
        <td
          key={s.id}
          className="border-b border-zinc-100 px-3 py-2 align-top tabular-nums dark:border-zinc-800/70"
        >
          {cell(s)}
        </td>
      ))}
    </tr>
  );
}

function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

function adoptionCell(s: ComparedServer): React.ReactNode {
  if (s.observedInRepos === 0) return <span className="text-zinc-400">not observed</span>;
  return (
    <span>
      {s.observedInRepos.toLocaleString()} repos
      {s.adoptionRank && <span className="ml-1 text-xs text-zinc-400">#{s.adoptionRank}</span>}
    </span>
  );
}

function securityCell(s: ComparedServer): React.ReactNode {
  if (s.hasSecurityMd === null) return "—";
  return s.hasSecurityMd ? (
    "present"
  ) : (
    <span className="text-amber-700 dark:text-amber-400">absent</span>
  );
}

function linksCell(s: ComparedServer): React.ReactNode {
  const links: React.ReactNode[] = [];
  if (s.homepage)
    links.push(
      <a key="h" href={s.homepage} className="text-blue-600 hover:underline">
        home
      </a>,
    );
  if (s.repoUrl)
    links.push(
      <a key="r" href={s.repoUrl} className="text-blue-600 hover:underline">
        repo
      </a>,
    );
  if (links.length === 0) return "—";
  return <span className="flex gap-2 text-xs">{links}</span>;
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
      Add servers above to compare them, or start from the{" "}
      <Link href="/catalog" className="text-blue-600 hover:underline">
        catalog
      </Link>
      . Tip: open any server page and use “Compare” to seed a set.
    </div>
  );
}
