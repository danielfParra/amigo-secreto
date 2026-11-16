import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { sortNames } from "@/lib/names";
import { HttpError, handle, json } from "@/lib/server/http";

/** Public with the invite code: what a person sees on the join page, including which names are already taken. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const groups = await sql`SELECT id, name, event_date::text AS event_date, price_cap FROM groups WHERE invite_code = ${code.toUpperCase()}`;
    if (!groups.length) throw new HttpError(404, "No encontramos ese grupo");
    const g = groups[0];
    const rows = await sql`SELECT id, name, (auth_hash IS NOT NULL) AS claimed FROM users WHERE group_id = ${g.id as string}`;
    const members = sortNames(
      rows.map((r) => ({ id: r.id as string, name: r.name as string, claimed: r.claimed as boolean })),
      (m) => m.name,
    );
    return json({ name: g.name, eventDate: g.event_date, priceCap: g.price_cap, members });
  });
}
