import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { fakeSalt } from "@/lib/server/auth";
import { handle, json } from "@/lib/server/http";

/** Public: the salt is not secret. Unknown emails get a stable fake one so existence is not revealed. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
    const rows = email ? await sql`SELECT salt FROM users WHERE email = ${email}` : [];
    return json({ salt: rows.length ? (rows[0].salt as string) : fakeSalt(email) });
  });
}
