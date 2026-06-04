"use client";

/**
 * "How it works" — a beginner-friendly, self-advancing explainer for visitors
 * who don't yet know what MCP is. Three steps narrate the chain (agents →
 * servers → your systems) and where ax-registry sits. Auto-advances, pauses on
 * hover, and every step is clickable + links into the product.
 *
 * Trust-language rule (§10.6): observed / measured — never verified / safe.
 * `videoUrl` is an optional slot for a real tour video once one exists.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const STEPS = [
  {
    title: "Agents connect to MCP servers",
    body:
      "AI agents — Claude, Cursor, VS Code — plug into MCP servers to extend what they can do beyond chat.",
    href: "/clients",
    link: "See the client landscape",
  },
  {
    title: "Servers get real access",
    body:
      "Each MCP server runs with real reach: your files, databases, APIs and secrets. Useful — and worth a look before you wire one in.",
    href: null as string | null, // filled with a live server page
    link: "Inspect a live server",
  },
  {
    title: "ax-registry measures it",
    body:
      "We measure which servers are actually used, by whom, and what access they request — from public configs — so you choose on evidence.",
    href: "/catalog?sort=observed",
    link: "Browse the catalog",
  },
];

export function HowItWorks({ serverHref, videoUrl }: { serverHref?: string; videoUrl?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 3800);
    return () => clearInterval(t);
  }, [paused]);

  const steps = STEPS.map((s, i) =>
    i === 1 ? { ...s, href: serverHref ?? "/catalog" } : s,
  );

  return (
    <section className="border-b border-white/10 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            New to MCP? Here&rsquo;s the gist
          </span>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
            What ax-registry shows you
          </h2>
        </div>

        <div
          className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Flow diagram */}
          <Flow active={active} />

          {/* Steps */}
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const on = i === active;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      on
                        ? "border-indigo-400/50 bg-indigo-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                          on ? "bg-indigo-500 text-white" : "bg-white/10 text-zinc-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className={`font-semibold ${on ? "text-white" : "text-zinc-200"}`}>
                          {s.title}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400">{s.body}</p>
                        <Link
                          href={s.href!}
                          className="mt-2 inline-block text-sm text-indigo-300 hover:underline"
                        >
                          {s.link} →
                        </Link>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {videoUrl && (
          <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-white/10">
            {/* eslint-disable-next-line jsx-a11y/iframe-has-title */}
            <iframe src={videoUrl} className="aspect-video w-full" allowFullScreen title="ax-registry tour" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Three-layer flow: Agents → MCP servers → Your systems, with the active step lit. */
function Flow({ active }: { active: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0c0e] p-6 sm:p-8">
      <div className="flex items-stretch justify-between gap-2 sm:gap-3">
        <Layer label="AI agents" sub="Claude · Cursor · VS Code" lit={active === 0} tone="zinc" />
        <Arrow lit={active === 0} />
        <Layer label="MCP servers" sub="tools the agent can call" lit={active === 0 || active === 2} tone="indigo" />
        <Arrow lit={active === 1} />
        <Layer label="Your systems" sub="files · DBs · APIs · secrets" lit={active === 1} tone="emerald" />
      </div>

      {/* ax-registry lens under the servers layer */}
      <div className="mt-5 flex justify-center">
        <span
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            active === 2
              ? "border-indigo-400/60 bg-indigo-500/15 text-indigo-200"
              : "border-white/10 bg-white/[0.03] text-zinc-500"
          }`}
        >
          ax-registry measures adoption &amp; access here
        </span>
      </div>
    </div>
  );
}

function Layer({
  label,
  sub,
  lit,
  tone,
}: {
  label: string;
  sub: string;
  lit: boolean;
  tone: "zinc" | "indigo" | "emerald";
}) {
  const ring =
    tone === "indigo"
      ? "ring-indigo-400/60"
      : tone === "emerald"
        ? "ring-emerald-400/60"
        : "ring-white/40";
  const dot =
    tone === "indigo" ? "bg-indigo-400" : tone === "emerald" ? "bg-emerald-400" : "bg-zinc-300";
  return (
    <div
      className={`flex flex-1 flex-col items-center rounded-xl border border-white/10 bg-white/[0.02] px-2 py-4 text-center transition-all ${
        lit ? `ring-2 ${ring} bg-white/[0.05]` : "opacity-80"
      }`}
    >
      <span className={`mb-2 h-2 w-2 rounded-full ${dot} ${lit ? "" : "opacity-40"}`} />
      <span className="text-xs font-semibold text-zinc-100 sm:text-sm">{label}</span>
      <span className="mt-0.5 text-[10px] leading-tight text-zinc-500 sm:text-xs">{sub}</span>
    </div>
  );
}

function Arrow({ lit }: { lit: boolean }) {
  return (
    <div className="flex items-center">
      <svg viewBox="0 0 24 12" className="h-3 w-6" aria-hidden>
        <path
          d="M0 6h20m0 0-5-4m5 4-5 4"
          fill="none"
          stroke={lit ? "#818cf8" : "#3f3f46"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
