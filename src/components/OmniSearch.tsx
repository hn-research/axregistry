"use client";

/**
 * The one search box used across the site (hero, catalog, anywhere). Type and a
 * grouped dropdown of matching SERVERS and CLIENTS appears, ranked by observed
 * adoption. Selecting a server opens its page; selecting a client opens the
 * catalog filtered to what that client wires up; pressing Enter on free text
 * runs a full catalog search.
 *
 * With `autodemo`, an idle hero instance auto-types example queries and lets the
 * real results animate in — a live, working product shot. The moment the user
 * focuses or types, the demo stops and the box is theirs.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KindChip } from "@/components/Viz";
import { idToHref } from "@/lib/serverPath";
import type { Kind } from "@/lib/kindStyle";

interface ServerHit {
  id: string;
  displayName: string;
  kind: Kind;
  observedRepos: number;
}
interface ClientHit {
  client: string;
  repos: number;
  servers: number;
}

type FlatItem =
  | { type: "server"; hit: ServerHit }
  | { type: "client"; hit: ClientHit };

const DEMO_QUERIES = ["postgres", "cursor", "github", "playwright", "filesystem", "claude"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function OmniSearch({
  size = "md",
  autodemo = false,
  placeholder = "Search servers and clients…",
  className = "",
}: {
  size?: "md" | "lg";
  autodemo?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [servers, setServers] = useState<ServerHit[]>([]);
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [demoing, setDemoing] = useState(autodemo);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const demoCancelled = useRef(false);

  const flat: FlatItem[] = [
    ...servers.map((hit) => ({ type: "server" as const, hit })),
    ...clients.map((hit) => ({ type: "client" as const, hit })),
  ];

  // Debounced live search — drives results for BOTH user typing and the demo
  // (the demo just sets `q`, which lands here once typing pauses).
  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setServers([]);
        setClients([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { servers: ServerHit[]; clients: ClientHit[] };
        setServers(data.servers ?? []);
        setClients(data.clients ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  // Auto-typing demo loop. Cancels permanently on first user interaction.
  useEffect(() => {
    if (!demoing) return;
    demoCancelled.current = false;
    (async () => {
      await sleep(800);
      let i = 0;
      while (!demoCancelled.current) {
        const word = DEMO_QUERIES[i % DEMO_QUERIES.length];
        for (let c = 1; c <= word.length; c++) {
          if (demoCancelled.current) return;
          setQ(word.slice(0, c));
          await sleep(115);
        }
        if (demoCancelled.current) return;
        await sleep(2300); // hold on the results
        for (let c = word.length - 1; c >= 0; c--) {
          if (demoCancelled.current) return;
          setQ(word.slice(0, c));
          await sleep(40);
        }
        await sleep(550);
        i++;
      }
    })();
    return () => {
      demoCancelled.current = true;
    };
  }, [demoing]);

  const stopDemo = useCallback(() => {
    if (!demoing) return;
    demoCancelled.current = true;
    setDemoing(false);
    setQ("");
    setServers([]);
    setClients([]);
    setOpen(false);
  }, [demoing]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(item: FlatItem) {
    if (item.type === "server") router.push(idToHref(item.hit.id));
    else router.push(`/catalog?client=${encodeURIComponent(item.hit.client)}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active]);
      else if (q.trim().length > 0) router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const lg = size === "lg";
  const showDropdown = open && (loading || flat.length > 0 || q.trim().length >= 2);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 ${
            lg ? "h-5 w-5" : "h-4 w-4"
          }`}
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => {
            if (demoing) stopDemo();
            setQ(e.target.value);
          }}
          onFocus={() => {
            if (demoing) stopDemo();
            else if (flat.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`w-full rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-zinc-500 transition-colors focus:border-white/30 focus:bg-white/[0.07] focus:outline-none ${
            lg ? "py-4 pl-12 pr-28 text-base" : "py-2.5 pl-10 pr-4 text-sm"
          }`}
        />
        {lg && (
          <button
            type="button"
            onClick={() => {
              if (active >= 0 && flat[active]) go(flat[active]);
              else if (q.trim().length > 0) router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
              else inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-90"
          >
            Search
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-2 max-h-[22rem] w-full overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-[#0d0e11] shadow-2xl shadow-black/50">
          {loading && flat.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">Searching…</div>
          )}
          {!loading && flat.length === 0 && (
            <div className="px-4 py-3 text-sm text-zinc-500">No matches.</div>
          )}

          {servers.length > 0 && (
            <Group label="Servers">
              {servers.map((s) => {
                const idx = flat.findIndex((f) => f.type === "server" && f.hit.id === s.id);
                return (
                  <Row key={s.id} activeRow={idx === active} onClick={() => go(flat[idx])}>
                    <span className="flex min-w-0 items-center gap-2">
                      <KindChip kind={s.kind} />
                      <span className="truncate text-zinc-100">{s.displayName}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {s.observedRepos > 0 ? `${s.observedRepos.toLocaleString()} repos` : "—"}
                    </span>
                  </Row>
                );
              })}
            </Group>
          )}

          {clients.length > 0 && (
            <Group label="Clients">
              {clients.map((c) => {
                const idx = flat.findIndex((f) => f.type === "client" && f.hit.client === c.client);
                return (
                  <Row key={c.client} activeRow={idx === active} onClick={() => go(flat[idx])}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                        client
                      </span>
                      <span className="truncate text-zinc-100">{c.client}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {c.servers.toLocaleString()} servers · {c.repos.toLocaleString()} repos
                    </span>
                  </Row>
                );
              })}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/5 first:border-t-0">
      <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </div>
      <ul className="pb-1">{children}</ul>
    </div>
  );
}

function Row({
  activeRow,
  onClick,
  children,
}: {
  activeRow: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${
          activeRow ? "bg-white/10" : "hover:bg-white/5"
        }`}
      >
        {children}
      </button>
    </li>
  );
}
