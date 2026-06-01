/**
 * Developer docs — the public read API, badges, embeds, and CSV exports.
 * Everything here serves public-signal data anyone can re-derive.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: "GET", path: "/api/v1/servers?q=&kind=&client=&sort=&page=&pageSize=", desc: "Query the catalog. sort = observed | downloads | stars | name." },
  { method: "GET", path: "/api/v1/servers/<id>", desc: "One server: facts, adoption count, client breakdown, and daily trend." },
  { method: "GET", path: "/api/v1/lists", desc: "Category leaderboards — top servers per category." },
  { method: "GET", path: "/api/v1/lists/<slug>", desc: "One category's full ranked list." },
  { method: "GET", path: "/api/v1/insights", desc: "Ecosystem totals, top adoption, kind distribution, client landscape, co-occurrence." },
  { method: "GET", path: "/api/export?kind=repos&server=<id>", desc: "CSV: every public repo wiring up a server." },
  { method: "GET", path: "/api/export?kind=stack&owner=<login>", desc: "CSV: every server a GitHub owner's repos use." },
];

export default function Developers() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="border-b border-white/10 pb-6">
        <h1 className="text-2xl font-semibold text-white">Developers</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          A public, read-only API plus badges, embeds, and CSV exports — all
          serving the same demand-side public signal the site shows. CORS-open,
          cached, no key required. Please be reasonable; this runs on a free tier.
        </p>
      </header>

      {/* JSON API */}
      <Block title="JSON API" subtitle="Base path /api/v1 · responses are JSON · open CORS">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="align-top">
                  <td className="w-14 px-3 py-3">
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                      {e.method}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <code className="break-all text-xs text-zinc-100">{e.path}</code>
                    <p className="mt-1 text-xs text-zinc-500">{e.desc}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Example: <Code>curl {SITE_URL}/api/v1/servers?sort=observed&pageSize=5</Code>
        </p>
      </Block>

      {/* Badge */}
      <Block title="Adoption badge" subtitle="A live SVG of the observed-repo count — paste into any README">
        <Code block>{`[![ax-ray](${SITE_URL}/badge/npm/<scope>/<name>.svg?metric=adoption)](${SITE_URL}/server/...)`}</Code>
        <p className="mt-2 text-xs text-zinc-500">
          The exact snippet for any server is on its page (and on the{" "}
          <Link href="/claim" className="text-indigo-300 hover:underline">claim</Link> page).
        </p>
      </Block>

      {/* Embed card */}
      <Block title="Embeddable card" subtitle="A self-contained HTML card for docs and dashboards">
        <Code block>{`<iframe src="${SITE_URL}/embed/npm/<scope>/<name>?theme=dark"
  width="340" height="64" frameborder="0" style="border:0"></iframe>`}</Code>
        <p className="mt-2 text-xs text-zinc-500">
          Shows the live adoption count and trend sparkline. <Code>?theme=light</Code> for light backgrounds.
        </p>
      </Block>

      {/* CSV */}
      <Block title="CSV export" subtitle="The reverse-lookup tables, downloadable">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li>
            <Code>/api/export?kind=repos&server=&lt;id&gt;</Code> — repos using a server (also the{" "}
            <em className="text-zinc-400">Export CSV</em> button on any <Link href="/repos?server=" className="text-indigo-300 hover:underline">repos-using</Link> view).
          </li>
          <li>
            <Code>/api/export?kind=stack&owner=&lt;login&gt;</Code> — the MCP stack of a GitHub owner (the{" "}
            <Link href="/org" className="text-indigo-300 hover:underline">org profiler</Link>).
          </li>
        </ul>
      </Block>

      <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-zinc-500">
        Observations, not endorsements — <em>observed</em>, <em>measured</em>,{" "}
        <em>listed</em>, never <em>verified</em> or <em>safe</em>.{" "}
        <Link href="/methodology" className="text-indigo-300 hover:underline">Methodology</Link>.
      </footer>
    </main>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-0.5 mb-4 text-sm text-zinc-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Code({ children, block }: { children: ReactNode; block?: boolean }) {
  if (block) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-xs text-zinc-300">
        <code>{children}</code>
      </pre>
    );
  }
  return <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-zinc-200">{children}</code>;
}
