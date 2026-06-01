/**
 * Full catalog browse (§3 v1). Search, filter by identity kind, sort, and
 * paginate the entire catalog — not just the homepage top-N. Server-rendered
 * from searchParams so every view is a shareable, cacheable URL.
 */

import Link from "next/link";
import { browseCatalog, type CatalogSort } from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";
import { KIND_LABEL, type Kind } from "@/lib/kindStyle";

export const dynamic = "force-dynamic";

const KINDS: Kind[] = ["npm", "pypi", "oci", "repo", "remote", "cmd"];
const SORTS: { key: CatalogSort; label: string }[] = [
  { key: "observed", label: "Observed in repos" },
  { key: "downloads", label: "Weekly downloads" },
  { key: "stars", label: "GitHub stars" },
  { key: "name", label: "Name" },
];

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const kind = KINDS.includes(sp.kind as Kind) ? (sp.kind as Kind) : undefined;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "observed") as CatalogSort;
  const page = Math.max(1, Number(sp.page) || 1);

  const result = await browseCatalog({ q, kind, sort, page, pageSize: 30 });
  const base = { q, kind, sort };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {result.total.toLocaleString()} servers across six identity kinds. Sort by{" "}
          <em>observed adoption</em> to see what real repositories actually wire up.
        </p>
      </header>

      {/* Controls */}
      <form className="mt-5 flex flex-wrap items-end gap-3" action="/catalog" method="get">
        <div className="grow">
          <label className="block text-xs text-zinc-500">Search</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="name or description…"
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Kind</label>
          <select
            name="kind"
            defaultValue={kind ?? ""}
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">all</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Sort</label>
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Apply
        </button>
        {(q || kind || sort !== "observed") && (
          <Link href="/catalog" className="py-1.5 text-sm text-blue-600 hover:underline">
            Reset
          </Link>
        )}
      </form>

      {/* Results */}
      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-medium">Server</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 text-right font-medium">Repos</th>
              <th className="px-3 py-2 text-right font-medium">↓/wk</th>
              <th className="px-3 py-2 text-right font-medium">★</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  No servers match.
                </td>
              </tr>
            ) : (
              result.items.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  <td className="max-w-0 px-3 py-2">
                    <Link href={idToHref(s.id)} className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.displayName}</span>
                      {s.claimed && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          claimed
                        </span>
                      )}
                    </Link>
                    {s.description && (
                      <p className="truncate text-xs text-zinc-500">{s.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <KindChip kind={s.kind} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.observedRepos > 0 ? (
                      s.observedRepos.toLocaleString()
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {s.weeklyDownloads !== null ? s.weeklyDownloads.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {s.stars !== null ? s.stars.toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav className="mt-4 flex items-center justify-between text-sm">
        <span className="text-zinc-500">
          Page {result.page} of {result.pageCount.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {result.page > 1 && (
            <Link
              href={`/catalog${qs({ ...base, page: result.page - 1 })}`}
              className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ← Prev
            </Link>
          )}
          {result.page < result.pageCount && (
            <Link
              href={`/catalog${qs({ ...base, page: result.page + 1 })}`}
              className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Next →
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}
