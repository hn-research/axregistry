"use client";

/**
 * Badge gallery for a server page (§7). The badge is the viral vector, so it is
 * offered for EVERY server — not just claimed ones. Two styles:
 *   - Adoption: "observed in N repos" — the number authors want to show off,
 *     re-derivable public demand-side signal (works for any server).
 *   - Status:   "attested N signals" / "claimed" / "listed" — the band the
 *     server currently sits in.
 * Each carries a copyable Markdown snippet that links back to the page.
 */

import { useState } from "react";
import { idToParts } from "@/lib/serverPath";

interface BadgeVariant {
  key: string;
  title: string;
  blurb: string;
  badgePath: string;
}

export function BadgeGallery({ id }: { id: string }) {
  const parts = idToParts(id).join("/");
  const pagePath = `/server/${parts}`;
  const variants: BadgeVariant[] = [
    {
      key: "adoption",
      title: "Adoption",
      blurb: "Live count of public repos observed wiring this server up.",
      badgePath: `/badge/${parts}.svg?metric=adoption`,
    },
    {
      key: "status",
      title: "Status",
      blurb: "The band this page currently sits in — observed, never a verdict.",
      badgePath: `/badge/${parts}.svg`,
    },
  ];

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {variants.map((v) => (
        <BadgeCard key={v.key} variant={v} pagePath={pagePath} />
      ))}
    </div>
  );
}

function BadgeCard({ variant, pagePath }: { variant: BadgeVariant; pagePath: string }) {
  const [copied, setCopied] = useState(false);
  const markdown = `[![ax-ray](${variant.badgePath})](${pagePath})`;

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {variant.title}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500">{variant.blurb}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={variant.badgePath} alt={`ax-ray ${variant.title} badge`} height={20} className="mt-2" />
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
          {markdown}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
    </div>
  );
}
