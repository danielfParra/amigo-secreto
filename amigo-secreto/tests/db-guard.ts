// Imported by every DB test. Tests TRUNCATE tables, so they must never touch the real database.
const test = process.env.DATABASE_URL_TEST;
if (!test) throw new Error("DATABASE_URL_TEST is not set; refusing to run DB tests");
if (test === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST equals DATABASE_URL; refusing to run DB tests");
}
// Route handlers and lib/db.ts read DATABASE_URL, so point it at the test database for this process only.
process.env.DATABASE_URL = test;
export const TEST_DATABASE_URL = test;
