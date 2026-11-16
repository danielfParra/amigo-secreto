import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { handle, json } from "@/lib/server/http";
import { COOKIE, clearSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const token = req.cookies.get(COOKIE)?.value;
    if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
    return clearSession(json({ ok: true }));
  });
}
