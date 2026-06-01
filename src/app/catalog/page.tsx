/**
 * Full catalog browse (§3 v1). Search, filter by identity kind, sort, and
 * paginate the entire catalog — not just the homepage top-N. Server-rendered
 * from searchParams so every view is a shareable, cacheable URL.
 *
 * The primary search is the shared OmniSearch typeahead (server + client
 * suggestions as you type); the kind/sort row below refines the current view.
 */

import Link from "next/link";
import { browseCatalog, type CatalogSort } from "@/lib/insights";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";
import { OmniSearch } from "@/components/OmniSearch";
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
  searchParams: Promise<{ q?: string; kind?: string; client?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const kind = KINDS.includes(sp.kind as Kind) ? (sp.kind as Kind) : undefined;
  const client = sp.client?.trim() || undefined;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "observed") as CatalogSort;
  const page = Math.max(1, Number(sp.page) || 1);

  const result = await browseCatalog({ q, kind, client, sort, page, pageSize: 30 });
  const base = { q, kind, client, sort };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold text-white">Catalog</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {result.total.toLocaleString()} servers across six identity kinds. Sort by{" "}
          <em>observed adoption</em> to see what real repositories actually wire up.
        </p>
      </header>

      {/* Primary search — shared typeahead with server + client suggestions. */}
      <div className="mt-6">
        <OmniSearch size="lg" placeholder="Search servers and clients…" />
      </div>

      {/* Active filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {q && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            search: <strong className="text-white">{q}</strong>
          </span>
        )}
        {client && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            client: <strong className="text-white">{client}</strong>
          </span>
        )}
        {(q || client) && (
          <Link
            href={`/catalog${qs({ kind, sort })}`}
            className="text-xs text-indigo-300 hover:underline"
          >
            clear
          </Link>
        )}
      </div>

      {/* Refine: kind + sort. Preserves the current q/client via hidden inputs. */}
      <form className="mt-4 flex flex-wrap items-end gap-3" action="/catalog" method="get">
        {q && <input type="hidden" name="q" value={q} />}
        {client && <input type="hidden" name="client" value={client} />}
        <div>
          <label className="block text-xs text-zinc-500">Kind</label>
          <select
            name="kind"
            defaultValue={kind ?? ""}
            className="mt-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
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
            className="mt-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
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
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
        >
          Apply
        </button>
        {(q || kind || client || sort !== "observed") && (
          <Link href="/catalog" className="py-1.5 text-sm text-indigo-300 hover:underline">
            Reset
          </Link>
        )}
      </form>

      {/* Results */}
      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Server</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 text-right font-medium">Repos</th>
              <th className="px-3 py-2 text-right font-medium">↓/wk</th>
              <th className="px-3 py-2 text-right font-medium">★</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  No servers match.
                </td>
              </tr>
            ) : (
              result.items.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.03]">
                  <td className="max-w-0 px-3 py-2">
                    <Link href={idToHref(s.id)} className="flex items-center gap-2">
                      <span className="truncate font-medium text-zinc-100">{s.displayName}</span>
                      {s.claimed && (
                        <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
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
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                    {s.observedRepos > 0 ? (
                      s.observedRepos.toLocaleString()
                    ) : (
                      <span className="text-zinc-700">—</span>
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
              className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/5"
            >
              ← Prev
            </Link>
          )}
          {result.page < result.pageCount && (
            <Link
              href={`/catalog${qs({ ...base, page: result.page + 1 })}`}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/5"
            >
              Next →
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}
