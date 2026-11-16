// Usage: tsx --env-file=.env.local scripts/migrate.ts DATABASE_URL_TEST   (or DATABASE_URL)
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const envName = process.argv[2];
  if (envName !== "DATABASE_URL" && envName !== "DATABASE_URL_TEST") {
    throw new Error("Pass DATABASE_URL or DATABASE_URL_TEST as the first argument");
  }
  const url = process.env[envName];
  if (!url) throw new Error(`${envName} is not set`);

  const file = fs.readFileSync(path.resolve(import.meta.dirname, "../db/schema.sql"), "utf8");
  const statements = file.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean);
  const sql = neon(url);
  for (const s of statements) await sql.query(s);
  const db = await sql`SELECT current_database() AS db`;
  console.log(`migrated ${statements.length} statements on ${db[0].db}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
