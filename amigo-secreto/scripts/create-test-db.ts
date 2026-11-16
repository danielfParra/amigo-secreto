// One-off: creates the separate `amigo_test` database next to the main one, so tests never touch real data.
import { neon } from "@neondatabase/serverless";

async function main() {
  const main = process.env.DATABASE_URL;
  const test = process.env.DATABASE_URL_TEST;
  if (!main || !test) throw new Error("DATABASE_URL and DATABASE_URL_TEST must be set");
  if (main === test) throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL");

  const sql = neon(main);
  const exists = await sql`SELECT 1 AS ok FROM pg_database WHERE datname = 'amigo_test'`;
  if (exists.length === 0) {
    await sql.query("CREATE DATABASE amigo_test");
    console.log("created amigo_test");
  } else {
    console.log("amigo_test already exists");
  }

  const t = await neon(test)`SELECT current_database() AS db`;
  console.log("test connection ok, database =", t[0].db);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
