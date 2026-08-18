/**
 * Client × server adoption heatmap (server-rendered). Rows = top servers,
 * columns = busiest clients, cell intensity = distinct repos wiring that server
 * up via that client. Shows at a glance which servers are client-specific vs
 * used everywhere. Cell colour scales by sqrt(value/max) so small cells stay
 * visible.
 */

import Link from "next/link";
import type { ClientServerMatrix } from "@/lib/clients";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export function ClientHeatmap({ matrix }: { matrix: ClientServerMatrix }) {
  const { clients, servers, max } = matrix;
  if (servers.length === 0 || clients.length === 0) {
    return <p className="text-sm text-zinc-500">No data yet.</p>;
  }

  const intensity = (v: number) => (v <= 0 ? 0 : Math.max(0.12, Math.sqrt(v / max)));

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[#0b0c0e] px-3 py-2 text-left text-xs font-medium text-zinc-500">
              Server
            </th>
            {clients.map((c) => (
              <th key={c.id} className="px-2 py-2 text-center align-bottom">
                <Link
                  href={`/clients/${encodeURIComponent(c.id)}`}
                  className="text-xs font-medium text-zinc-400 hover:text-white hover:underline"
                >
                  {c.label}
                </Link>
                <div className="text-[10px] tabular-nums text-zinc-600">
                  {c.total.toLocaleString()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => (
            <tr key={s.serverId} className="border-t border-white/5">
              <th className="sticky left-0 z-10 max-w-[260px] bg-[#0b0c0e] px-3 py-1.5 text-left font-normal">
                <Link href={idToHref(s.serverId)} className="flex min-w-0 items-center gap-2">
                  <KindChip kind={s.kind} />
                  <span className="truncate text-zinc-200 hover:text-white hover:underline">
                    {s.displayName}
                  </span>
                </Link>
              </th>
              {clients.map((c) => {
                const v = s.byClient[c.id] ?? 0;
                const a = intensity(v);
                return (
                  <td
                    key={c.id}
                    className="px-2 py-1.5 text-center text-xs tabular-nums"
                    style={{
                      backgroundColor: v > 0 ? `rgba(99,102,241,${a.toFixed(3)})` : undefined,
                      color: a > 0.55 ? "#fff" : v > 0 ? "#c7d2fe" : "#3f3f46",
                    }}
                  >
                    {v > 0 ? v.toLocaleString() : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
