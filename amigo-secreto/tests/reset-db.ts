import "./db-guard"; // refuses to run unless pointed at the test database
import { sql } from "@/lib/db";

/** Empties every table. Only ever runs against DATABASE_URL_TEST (see db-guard). */
export async function resetDb(): Promise<void> {
  await sql`TRUNCATE sessions, results, inbox, chat_messages, chat_threads, wishes, users, groups RESTART IDENTITY CASCADE`;
}
