/**
 * Dependency-light visualization primitives (REGISTRY-DESIGN.md §11.2 — reads
 * are cacheable, so charts are server-rendered CSS/SVG with zero client JS).
 * Interactive pieces (the relationship graph) live in their own client island.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { KIND_CHIP, type Kind } from "@/lib/kindStyle";

/** A small colored chip naming an identity kind (§11.1). */
export function KindChip({ kind }: { kind: Kind }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_CHIP[kind]}`}
    >
      {kind}
    </span>
  );
}

/** A single headline number with a label and optional sublabel. */
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-2xl font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-xs font-medium text-zinc-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-400">{sub}</div>}
    </div>
  );
}

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  href?: string;
  color?: string;
}

/**
 * Horizontal ranked bar list. The longest row defines full width; everything
 * else scales relative to it. Pure CSS, no JS.
 */
export function BarList({
  rows,
  unit = "",
  max,
}: {
  rows: BarRow[];
  unit?: string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(2, Math.round((r.value / top) * 100));
        const body = (
          <div className="relative flex items-center justify-between gap-3 rounded px-2 py-1.5">
            <div
              className="absolute inset-y-0 left-0 rounded"
              style={{ width: `${pct}%`, backgroundColor: r.color ?? "#6366f1", opacity: 0.16 }}
              aria-hidden
            />
            <span className="relative z-10 min-w-0 truncate text-sm">{r.label}</span>
            <span className="relative z-10 shrink-0 text-xs tabular-nums text-zinc-500">
              {r.value.toLocaleString()}
              {unit}
            </span>
          </div>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="block hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface DistributionSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * A single stacked horizontal bar showing composition (e.g. server kinds),
 * with a legend. Shares sum to 100%.
 */
export function DistributionBar({ slices }: { slices: DistributionSlice[] }) {
  const total = Math.max(1, slices.reduce((a, s) => a + s.value, 0));
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {slices.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.value.toLocaleString()} (${Math.round((s.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-zinc-600 dark:text-zinc-400">{s.label}</span>
            <span className="tabular-nums text-zinc-400">
              {s.value.toLocaleString()} ({Math.round((s.value / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Section wrapper with a title and optional source note (mirrors the bands). */
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <span className="text-xs text-zinc-400">{note}</span>}
      </div>
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">{children}</div>
    </section>
  );
}

/**
 * A tiny inline trend line (server-rendered SVG, zero client JS). `points` is a
 * chronological series; the line is normalized to the box. Renders nothing
 * useful below two points — callers should gate on that.
 */
export function Sparkline({
  points,
  width = 220,
  height = 48,
  color = "#818cf8",
  className = "",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p - min) / span);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${height - pad} L${coords[0][0].toFixed(1)} ${height - pad} Z`;
  const [lx, ly] = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  );
}
