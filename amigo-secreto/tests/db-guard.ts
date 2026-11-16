// Imported by every DB test. Tests TRUNCATE tables, so they must never touch the real database.
// vitest.config.mts already replaces DATABASE_URL with DATABASE_URL_TEST; this is the second line of defense.
const test = process.env.DATABASE_URL_TEST;
if (!test) throw new Error("DATABASE_URL_TEST is not set; refusing to run DB tests");
if (process.env.DATABASE_URL !== test) {
  throw new Error("DATABASE_URL is not the test database; refusing to run DB tests");
}
const dbName = new URL(test).pathname.replace(/^\//, "");
if (!/test/i.test(dbName)) {
  throw new Error(`Database "${dbName}" does not look like a test database; refusing to run DB tests`);
}
export const TEST_DATABASE_URL = test;
