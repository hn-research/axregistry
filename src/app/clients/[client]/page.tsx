/**
 * One client's full server landscape — the servers configured via this client,
 * ranked by distinct public repos. The reverse-direction counterpart to a
 * server's "used by" page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { idToHref } from "@/lib/serverPath";
import { KindChip } from "@/components/Viz";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ client: string }>;
}) {
  const { client } = await params;
  const id = decodeURIComponent(client);
  const detail = await getClient(id);
  if (!detail) notFound();

  const max = detail.all.reduce((m, s) => Math.max(m, s.repos), 0) || 1;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <nav className="text-xs text-zinc-500">
        <Link href="/clients" className="hover:text-zinc-300 hover:underline">
          Clients
        </Link>{" "}
        / <span className="text-zinc-400">{detail.label}</span>
      </nav>

      <header className="mt-3">
        <h1 className="text-2xl font-semibold text-white">{detail.label}</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">{detail.blurb}</p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Stat value={detail.servers} label="servers configured" />
          <Stat value={detail.repos} label="repos observed" />
          <Stat value={detail.placements} label="total placements" />
        </div>
      </header>

      <ol className="mt-8 space-y-1">
        {detail.all.map((s, i) => (
          <li
            key={s.serverId}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]"
          >
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-zinc-600">
              {i + 1}
            </span>
            <Link href={idToHref(s.serverId)} className="flex min-w-0 grow items-center gap-2">
              <KindChip kind={s.kind} />
              <span className="truncate text-zinc-200 hover:text-white hover:underline">
                {s.displayName}
              </span>
            </Link>
            <div className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-white/5 sm:block">
              <div
                className="h-full rounded-full bg-indigo-500/70"
                style={{ width: `${Math.max(3, Math.round((s.repos / max) * 100))}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-zinc-500">
              {s.repos > 0 ? `${s.repos.toLocaleString()} repos` : "—"}
            </span>
          </li>
        ))}
      </ol>

      <footer className="mt-10 text-xs text-zinc-500">
        Ranked by distinct public repositories observed wiring each server up via{" "}
        {detail.label}. Public-config signal; ax-ray submissions add live on-machine
        usage.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">
          How this is computed
        </Link>
        .
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="tabular-nums">
      <span className="text-lg font-semibold text-white">{value.toLocaleString()}</span>{" "}
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}
