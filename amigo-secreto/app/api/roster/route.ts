import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { sortNames } from "@/lib/names";
import { getTheGroup } from "@/lib/server/group";
import { handle, json } from "@/lib/server/http";

/** Public: the names people can sign in as (only those who have already joined). Names only, nothing secret. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    req.headers.get("accept"); // reading the request makes this route per-request, so it is never prerendered at build time
    const g = await getTheGroup();
    if (!g) return json({ group: null, members: [] });
    const rows = await sql`SELECT id, name FROM users WHERE group_id = ${g.id as string} AND auth_hash IS NOT NULL`;
    const members = sortNames(
      rows.map((r) => ({ id: r.id as string, name: r.name as string })),
      (m) => m.name,
    );
    return json({ group: { name: g.name, eventDate: g.event_date, priceCap: g.price_cap }, members });
  });
}
