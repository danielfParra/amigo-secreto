import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { HttpError, handle, json } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

/** Returns only the caller's own ciphertext; the browser decrypts it with the caller's private key. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession(req);
    const rows = await sql`SELECT sealed FROM results WHERE giver_id = ${s.userId}`;
    if (!rows.length) throw new HttpError(404, "El sorteo aún no se ha hecho");
    return json({ sealed: rows[0].sealed });
  });
}
