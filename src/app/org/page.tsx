/**
 * Reverse lookup B — the MCP stack of a GitHub owner: every server that the
 * owner's public repos wire up, ranked by how many of their repos use it. The
 * profiling view. CSV export available.
 */

import Link from "next/link";
import { orgStack } from "@/lib/reverse";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function OrgPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const { owner: ownerParam } = await searchParams;
  const owner = ownerParam?.trim() || undefined;
  const data = owner ? await orgStack(owner) : null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="border-b border-white/10 pb-5">
        <h1 className="text-2xl font-semibold text-white">Org stack profiler</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          The MCP servers a GitHub owner&rsquo;s public repositories wire up,
          ranked by how many of their repos use each one. Demand-side signal,
          re-derivable by anyone.
        </p>
        <form method="get" action="/org" className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grow sm:grow-0">
            <label htmlFor="owner" className="block text-xs text-zinc-500">
              GitHub owner / org
            </label>
            <input
              id="owner"
              name="owner"
              defaultValue={owner ?? ""}
              placeholder="e.g. modelcontextprotocol"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none sm:w-72"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
          >
            Profile
          </button>
          {data && data.servers.length > 0 && (
            <a
              href={`/api/export?kind=stack&owner=${encodeURIComponent(owner!)}`}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
            >
              Export CSV
            </a>
          )}
        </form>
      </header>

      {!data ? (
        <p className="mt-10 text-sm text-zinc-500">
          Enter a GitHub owner above to see the servers their repos wire up.
        </p>
      ) : data.servers.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">
          No MCP usage observed in public repos under{" "}
          <strong className="text-zinc-300">{data.owner}</strong> yet.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-zinc-400">
            <strong className="text-zinc-200">{data.owner}</strong>:{" "}
            {data.servers.length.toLocaleString()} distinct{" "}
            {data.servers.length === 1 ? "server" : "servers"} across{" "}
            {data.repoCount.toLocaleString()} {data.repoCount === 1 ? "repo" : "repos"}.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Server</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 text-right font-medium">Repos using</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.servers.map((s) => (
                  <tr key={s.serverId} className="hover:bg-white/[0.03]">
                    <td className="px-3 py-2">
                      <Link
                        href={idToHref(s.serverId)}
                        className="font-medium text-zinc-100 hover:text-white hover:underline"
                      >
                        {s.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <KindChip kind={s.kind} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                      {s.repos.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
