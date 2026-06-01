/**
 * Database client — Neon serverless Postgres over HTTP, wired to Drizzle.
 *
 * The HTTP driver is the right fit for a read-mostly, edge/serverless app
 * (§11.2): no connection pool to manage, cheap cold starts. DATABASE_URL is a
 * Neon pooled connection string; it is the only secret this app needs.
 *
 * The client is created LAZILY on first use, not at import time, so building
 * the app (and importing modules for analysis) does not require DATABASE_URL —
 * only running a query does.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export { schema };

type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Neon database.",
    );
  }
  _db = drizzle(neon(databaseUrl), { schema });
  return _db;
}

/** Lazy proxy: forwards every access to the real client, created on first use. */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as DB;
