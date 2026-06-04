/**
 * Ingestion controller — one trigger, self-configuring, stateful.
 *
 *   npm run ingest                 # run all enabled phases using DB config
 *   npm run ingest -- config       # print current config + last run
 *   npm run ingest -- set <k> <v>  # change a knob in the DB (e.g. crawlMaxPages 6)
 *
 * Reads its knobs from the `ingest_config` table (not env flags), runs the
 * phases (seed → crawl → enrich → snapshot), and logs the run to `ingest_runs`
 * with before/after catalog counts so it reports what changed since last time.
 * The crawl auto-resumes via its checkpoint and enrich auto-advances through
 * un-enriched servers, so repeated triggers make progress without any flags.
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import {
  loadSettings,
  setSetting,
  currentCounts,
  startRun,
  finishRun,
  lastFinishedRun,
  DEFAULT_SETTINGS,
  type IngestSettings,
  type CatalogCounts,
} from "../src/lib/ingest-control";

function coerce(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function runPhase(name: string, env: NodeJS.ProcessEnv): boolean {
  console.log(`\n──────── ${name} ────────`);
  const r = spawnSync("npm", ["run", name], { stdio: "inherit", env });
  if (r.status !== 0) {
    console.log(`  [ingest] phase "${name}" exited ${r.status} — continuing.`);
    return false;
  }
  return true;
}

function envFor(s: IngestSettings): NodeJS.ProcessEnv {
  return {
    ...process.env,
    SEED_MAX_PER_QUERY: String(s.seedMaxPerQuery),
    SEED_PYPI_PAGES: String(s.seedPypiPages),
    SEED_GITHUB_PAGES: String(s.seedGithubPages),
    CRAWL_MAX_PAGES: String(s.crawlMaxPages),
    ENRICH_LIMIT: String(s.enrichLimit),
  };
}

function delta(a: CatalogCounts, b: CatalogCounts): string {
  const d = (k: keyof CatalogCounts) => {
    const diff = b[k] - a[k];
    return `${b[k].toLocaleString()} (${diff >= 0 ? "+" : ""}${diff})`;
  };
  return `servers ${d("servers")} · repos ${d("consumers")} · edges ${d("usages")}`;
}

const PHASES = ["seed", "crawl", "enrich", "snapshot"] as const;
type Phase = (typeof PHASES)[number];
const RUN_FLAG: Record<Phase, keyof IngestSettings> = {
  seed: "runSeed",
  crawl: "runCrawl",
  enrich: "runEnrich",
  snapshot: "runSnapshot",
};

/** Read `--flag value` from argv (returns undefined if absent). */
function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function parsePhases(arg: string | undefined): Phase[] | undefined {
  if (!arg) return undefined;
  const wanted = arg.split(",").map((s) => s.trim().toLowerCase());
  const bad = wanted.filter((p) => !PHASES.includes(p as Phase));
  if (bad.length) {
    console.error(`unknown phase(s): ${bad.join(", ")}. Known: ${PHASES.join(", ")}`);
    process.exit(1);
  }
  return PHASES.filter((p) => wanted.includes(p)); // canonical order
}

async function main() {
  const argv = process.argv.slice(2);
  // --only crawl,enrich  → run exactly those phases (overrides DB flags)
  // --skip snapshot      → subtract from the flag-enabled set
  const onlyArg = flagValue(argv, "--only");
  const skipArg = flagValue(argv, "--skip");
  const flagVals = new Set([onlyArg, skipArg].filter(Boolean) as string[]);
  const positional = argv.filter((a) => !a.startsWith("--") && !flagVals.has(a));
  const [cmd, ...rest] = positional;

  if (cmd === "set") {
    const [key, value] = rest;
    if (!key || value === undefined) {
      console.error("usage: npm run ingest -- set <key> <value>");
      process.exit(1);
    }
    if (!(key in DEFAULT_SETTINGS)) {
      console.error(`unknown key "${key}". Known: ${Object.keys(DEFAULT_SETTINGS).join(", ")}`);
      process.exit(1);
    }
    await setSetting(key, coerce(value));
    console.log(`Set ${key} = ${value}`);
    return;
  }

  const settings = await loadSettings();

  if (cmd === "config") {
    console.log("ingest config:", JSON.stringify(settings, null, 2));
    const last = await lastFinishedRun();
    if (last?.after) {
      console.log(`last run: ${last.finishedAt?.toISOString?.() ?? last.finishedAt} →`, last.after);
    } else {
      console.log("last run: (none yet)");
    }
    return;
  }

  // Resolve which phases run this trigger. Default = whatever the DB flags
  // enable; `--only` makes it exactly that subset; `--skip` subtracts.
  const only = parsePhases(onlyArg);
  const skip = parsePhases(skipArg) ?? [];
  const selected = (only ?? PHASES.filter((p) => settings[RUN_FLAG[p]])).filter(
    (p) => !skip.includes(p),
  );

  const before = await currentCounts();
  const last = await lastFinishedRun();
  const runId = await startRun(before);

  console.log("Starting ingest with config:", settings);
  console.log("Phases this run:", selected.join(", ") || "(none)");
  console.log("Catalog before:", before);

  const env = envFor(settings);
  for (const phase of PHASES) {
    if (selected.includes(phase)) runPhase(phase, env);
  }

  const after = await currentCounts();
  await finishRun(runId, after, "ok");

  console.log("\n──────── done ────────");
  if (last?.after) {
    console.log(`Previous total: servers ${(last.after as CatalogCounts).servers}, repos ${(last.after as CatalogCounts).consumers}`);
  }
  console.log(`This run:       ${delta(before, after)}`);
  console.log("Tip: re-run `npm run ingest` to go deeper (crawl resumes, enrich advances).");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
