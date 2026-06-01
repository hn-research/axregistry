"use client";

/**
 * Site header — sticky, blurred, Linear-style. Active route is highlighted via
 * usePathname. The primary action (Scan) is a filled button; the rest are quiet
 * links that brighten on hover.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/catalog", label: "Catalog" },
  { href: "/lists", label: "Lists" },
  { href: "/compare", label: "Compare" },
  { href: "/insights", label: "Insights" },
  { href: "/developers", label: "API" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteNav({ authSlot }: { authSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090b]/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 text-sm">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-[5px] bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_0_12px_rgba(129,140,248,0.5)]" />
          <span>ax-registry</span>
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                isActive(l.href)
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="mx-2 h-4 w-px bg-white/10" />
          <Link
            href="/claim"
            className="rounded-md px-3 py-1.5 text-zinc-400 transition-colors hover:text-white"
          >
            Claim
          </Link>
          <Link
            href="/scan"
            className="rounded-md bg-white px-3.5 py-1.5 font-medium text-zinc-900 transition-opacity hover:opacity-90"
          >
            Scan stack
          </Link>
          {authSlot ? (
            <>
              <div className="mx-2 h-4 w-px bg-white/10" />
              {authSlot}
            </>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
