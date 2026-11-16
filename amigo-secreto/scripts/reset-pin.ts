// Admin tool: lets someone who forgot their PIN choose a new one the next time they sign in.
// Works for anyone who has joined, including the organizer (who cannot reset their own PIN from the app).
//
//   npx tsx --env-file=.env.local scripts/reset-pin.ts "Nombre Apellido"
//   npx tsx --env-file=.env.local scripts/reset-pin.ts "Nombre Apellido" DATABASE_URL_TEST
//
// Their old PIN cannot be recovered, so they get a new key. If the draw was already done it is reopened.
const wanted = (process.argv[2] ?? "").trim();
const envName = process.argv[3] ?? "DATABASE_URL";

async function main() {
  if (!wanted) throw new Error('Usage: reset-pin.ts "<full name>" [DATABASE_URL | DATABASE_URL_TEST]');
  if (envName !== "DATABASE_URL" && envName !== "DATABASE_URL_TEST") throw new Error(`Unknown database variable ${envName}`);
  const url = process.env[envName];
  if (!url) throw new Error(`${envName} is not set (run with --env-file=.env.local)`);
  process.env.DATABASE_URL = url; // lib/db reads this lazily

  const { sql } = await import("../lib/db");
  const { nameKey } = await import("../lib/names");
  const { startPinReset, PIN_RESET_DAYS } = await import("../lib/server/pin-reset");
  const rows = await sql`SELECT id, name, group_id, (auth_hash IS NOT NULL) AS claimed FROM users`;
  const matches = rows.filter((r) => nameKey(String(r.name)) === nameKey(wanted));
  if (!matches.length) throw new Error(`Nobody called "${wanted}" is on the list`);
  const person = matches[0];
  if (!person.claimed) throw new Error(`${person.name} has not joined yet, so there is no PIN to reset`);
  const { drawReset } = await startPinReset(person.group_id as string, person.id as string);
  console.log(`PIN reset opened for ${person.name} for ${PIN_RESET_DAYS} days.`);
  console.log(drawReset ? "The draw was already done, so it was reopened: run it again." : "The draw had not been done; nothing else changed.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
