/**
 * One category's full leaderboard — every server in the space ranked by
 * observed adoption, with downloads and stars alongside.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/categories";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const group = await getCategory(slug);
  if (!group) notFound();

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="border-b border-white/10 pb-5">
        <Link href="/lists" className="text-xs text-indigo-300 hover:underline">
          ← All categories
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">{group.label}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {group.total.toLocaleString()} servers · {group.blurb} Ranked by distinct
          public repositories observed wiring each one up.
        </p>
      </header>

      <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Server</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 text-right font-medium">Repos</th>
              <th className="px-3 py-2 text-right font-medium">↓/wk</th>
              <th className="px-3 py-2 text-right font-medium">★</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {group.servers.map((s, i) => (
              <tr key={s.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2 tabular-nums text-zinc-600">{i + 1}</td>
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
                  {s.observedRepos > 0 ? s.observedRepos.toLocaleString() : <span className="text-zinc-700">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                  {s.weeklyDownloads !== null ? s.weeklyDownloads.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                  {s.stars !== null ? s.stars.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
