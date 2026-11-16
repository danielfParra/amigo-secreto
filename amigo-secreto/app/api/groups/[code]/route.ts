import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { HttpError, handle, json } from "@/lib/server/http";

/** Public: what a person sees on the invite page before they have an account. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const rows = await sql`SELECT name, event_date::text AS event_date, price_cap FROM groups WHERE invite_code = ${code.toUpperCase()}`;
    if (!rows.length) throw new HttpError(404, "No encontramos ese grupo");
    const g = rows[0];
    return json({ name: g.name, eventDate: g.event_date, priceCap: g.price_cap });
  });
}
