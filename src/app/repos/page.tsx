/**
 * Reverse lookup A — every public repo that wires up a given server. The
 * lead-gen / footprint view. Opted-out repos are counted in the total but never
 * named (§10); we surface the hidden count instead. CSV export available.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerRecord } from "@/lib/queries";
import { reposUsingServer } from "@/lib/reverse";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function ReposUsingPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string }>;
}) {
  const { server: serverParam } = await searchParams;
  if (!serverParam) notFound();
  const record = await getServerRecord(serverParam);
  if (!record) notFound();
  const { server } = record;

  const data = await reposUsingServer(server.id);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="border-b border-white/10 pb-5">
        <Link href={idToHref(server.id)} className="text-xs text-indigo-300 hover:underline">
          ← {server.displayName}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KindChip kind={server.kind} />
            <h1 className="text-2xl font-semibold text-white">
              Repos using {server.displayName}
            </h1>
          </div>
          {data.named > 0 && (
            <a
              href={`/api/export?kind=repos&server=${encodeURIComponent(server.id)}`}
              className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
            >
              Export CSV
            </a>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {data.total.toLocaleString()} public{" "}
          {data.total === 1 ? "repository" : "repositories"} observed wiring this server up
          {data.hidden > 0 && (
            <>
              {" "}
              — <span className="text-zinc-300">{data.hidden.toLocaleString()}</span> opted out of
              listing (counted, not named)
            </>
          )}
          .
        </p>
      </header>

      {data.repos.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No nameable public repositories yet.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Repository</th>
                <th className="px-3 py-2 font-medium">Wired via</th>
                <th className="px-3 py-2 text-right font-medium">★</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.repos.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2">
                    <a
                      href={`https://github.com/${r.owner}/${r.name}`}
                      className="font-medium text-zinc-100 hover:text-white hover:underline"
                    >
                      {r.owner}/{r.name}
                    </a>
                    <Link
                      href={`/org?owner=${encodeURIComponent(r.owner)}`}
                      className="ml-2 text-xs text-indigo-300/70 hover:text-indigo-300 hover:underline"
                    >
                      org stack →
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.clients.length > 0 ? r.clients.join(", ") : "—"}
                    {r.placements > 1 && (
                      <span className="text-zinc-600"> · {r.placements} placements</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {r.stars !== null ? r.stars.toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="mt-6 text-xs text-zinc-500">
        Demand-side signal from public GitHub configs.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How this is computed
        </Link>
        .
      </footer>
    </main>
  );
}
