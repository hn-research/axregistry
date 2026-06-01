import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Safety guard: drizzle-kit must only ever touch the ax-registry database.
// (We once pointed DATABASE_URL at the Alembic-managed `authority` DB by
// accident — this makes that mistake impossible to apply.)
const url = process.env.DATABASE_URL;
if (url) {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  const allowed = process.env.AXREGISTRY_DB_NAME ?? "axregistry";
  if (dbName !== allowed) {
    throw new Error(
      `Refusing to run drizzle-kit against database "${dbName}". ` +
        `Expected "${allowed}". Check DATABASE_URL — it must point at the ax-registry database, ` +
        `not authority or any other shared database.`,
    );
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
