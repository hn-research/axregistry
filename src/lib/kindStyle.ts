/**
 * Shared visual vocabulary for the six identity kinds (§11.1). One color per
 * kind, used consistently across badges, bars, distribution charts, and the
 * relationship graph so a reader learns the palette once.
 */
import type { Server } from "@/db/schema";

export type Kind = Server["kind"];

/** Tailwind classes for a small kind chip. */
export const KIND_CHIP: Record<Kind, string> = {
  npm: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  pypi: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  oci: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  repo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  remote: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  cmd: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

/** Raw fill colors (for SVG / inline bars), light and readable on both themes. */
export const KIND_FILL: Record<Kind, string> = {
  npm: "#ef4444",
  pypi: "#3b82f6",
  oci: "#0ea5e9",
  repo: "#a1a1aa",
  remote: "#8b5cf6",
  cmd: "#f59e0b",
};

export const KIND_LABEL: Record<Kind, string> = {
  npm: "npm",
  pypi: "PyPI",
  oci: "OCI / Docker",
  repo: "source repo",
  remote: "remote endpoint",
  cmd: "local command",
};
