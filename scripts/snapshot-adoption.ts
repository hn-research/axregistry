/**
 * Daily adoption snapshot. Records today's distinct-public-repo count for every
 * server that has any observed usage, into `adoption_snapshots`. Idempotent per
 * day (re-running overwrites today's row), so it's safe to schedule daily and
 * to re-run by hand.
 *
 *   npm run snapshot
 *
 * Run it daily (cron / GitHub Action) — the trend lines on server pages fill in
 * as days accrue.
 */

import "dotenv/config";
import { countDistinct } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { usages, adoptionSnapshots } from "../src/db/schema";

const CHUNK = 500;

async function main() {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  const rows = await db
    .select({ serverId: usages.serverId, repos: countDistinct(usages.consumerId) })
    .from(usages)
    .groupBy(usages.serverId);

  if (rows.length === 0) {
    console.log("No usage rows yet — nothing to snapshot.");
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      serverId: r.serverId,
      day,
      observedRepos: r.repos,
    }));
    await db
      .insert(adoptionSnapshots)
      .values(batch)
      .onConflictDoUpdate({
        target: [adoptionSnapshots.serverId, adoptionSnapshots.day],
        set: { observedRepos: sql`excluded.observed_repos` },
      });
    written += batch.length;
  }

  console.log(`Snapshot ${day}: wrote ${written} server adoption rows.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
