"use client";

/**
 * Interactive typeahead for building a comparison set. Search as you type, click
 * to add — the current set is passed in via `currentIds` and carried forward in
 * the URL (?ids=…), so adding never loses prior picks and the view stays
 * shareable. No need to remember exact server names.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KindChip } from "@/components/Viz";
import type { Kind } from "@/lib/kindStyle";

interface Hit {
  id: string;
  displayName: string;
  kind: Kind;
  observedRepos: number;
}

export function ServerSearch({ currentIds, max }: { currentIds: string[]; max: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const atMax = currentIds.length >= max;

  // Debounced search. All setState happens inside the async timeout (never
  // synchronously in the effect body) to avoid cascading renders.
  useEffect(() => {
    const term = q.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (term.length < 2) {
        setHits([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { servers: Hit[] };
        setHits(data.servers ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — leave prior hits */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function add(id: string) {
    if (atMax || currentIds.includes(id)) return;
    const next = [...currentIds, id];
    setQ("");
    setHits([]);
    setOpen(false);
    router.push(`/compare?ids=${encodeURIComponent(next.join(","))}`);
  }

  const results = hits.filter((h) => !currentIds.includes(h.id));

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="server-search" className="block text-xs text-zinc-500">
        Add a server (type to search)
      </label>
      <input
        id="server-search"
        value={q}
        disabled={atMax}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder={atMax ? `Max ${max} servers` : "playwright, filesystem, context7…"}
        autoComplete="off"
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      />

      {open && (results.length > 0 || loading || q.trim().length >= 2) && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-400">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-400">No matches.</li>
          )}
          {results.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => add(h.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <KindChip kind={h.kind} />
                  <span className="truncate">{h.displayName}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {h.observedRepos > 0 ? `${h.observedRepos.toLocaleString()} repos` : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
