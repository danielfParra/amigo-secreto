// Admin tool: lets someone who forgot their PIN choose a new one the next time they sign in.
// Works for anyone, including the organizer (who cannot reset their own PIN from the app).
//
//   npx tsx --env-file=.env.local scripts/reset-pin.ts someone@example.com
//   npx tsx --env-file=.env.local scripts/reset-pin.ts someone@example.com DATABASE_URL_TEST
//
// Their old PIN cannot be recovered, so they get a new key. If the draw was already done it is reopened.
const email = (process.argv[2] ?? "").trim().toLowerCase();
const envName = process.argv[3] ?? "DATABASE_URL";

async function main() {
  if (!email) throw new Error("Usage: reset-pin.ts <email> [DATABASE_URL | DATABASE_URL_TEST]");
  if (envName !== "DATABASE_URL" && envName !== "DATABASE_URL_TEST") throw new Error(`Unknown database variable ${envName}`);
  const url = process.env[envName];
  if (!url) throw new Error(`${envName} is not set (run with --env-file=.env.local)`);
  process.env.DATABASE_URL = url; // lib/db reads this lazily

  const { sql } = await import("../lib/db");
  const { startPinReset, PIN_RESET_DAYS } = await import("../lib/server/pin-reset");
  const rows = await sql`SELECT id, name, group_id FROM users WHERE email = ${email}`;
  if (!rows.length) throw new Error(`No account with email ${email}`);
  const { drawReset } = await startPinReset(rows[0].group_id as string, rows[0].id as string);
  console.log(`PIN reset opened for ${rows[0].name} (${email}) for ${PIN_RESET_DAYS} days.`);
  console.log(drawReset ? "The draw was already done, so it was reopened: run it again." : "The draw had not been done; nothing else changed.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
