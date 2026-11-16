import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { fakeSalt } from "@/lib/server/auth";
import { UUID } from "@/lib/server/group";
import { handle, json } from "@/lib/server/http";

/** Public: the salt is not secret. Unknown or unclaimed members get a stable fake one so nothing is revealed. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const memberId = (req.nextUrl.searchParams.get("memberId") ?? "").trim().toLowerCase();
    const rows = UUID.test(memberId)
      ? await sql`
          SELECT salt, (pin_reset_until IS NOT NULL AND pin_reset_until > now()) AS reset
          FROM users WHERE id = ${memberId} AND auth_hash IS NOT NULL`
      : [];
    return json(
      rows.length
        ? { salt: rows[0].salt as string, reset: rows[0].reset === true }
        : { salt: fakeSalt(memberId), reset: false },
    );
  });
}
