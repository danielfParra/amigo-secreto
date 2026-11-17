import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { handle, json } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession(req);
    const rows = await sql`
      SELECT u.id, u.name, u.wrapped_private_key, u.wrap_iv, u.salt,
             g.name AS group_name, g.event_date::text AS event_date, g.price_cap, g.draw_done, g.invite_code,
             (g.organizer_id = u.id) AS is_organizer
      FROM users u JOIN groups g ON g.id = u.group_id
      WHERE u.id = ${s.userId}`;
    const r = rows[0];
    const wishes = await sql`SELECT title, price, link, details FROM wishes WHERE user_id = ${s.userId} ORDER BY position`;
    return json({
      user: { id: r.id, name: r.name, isOrganizer: r.is_organizer },
      group: {
        name: r.group_name,
        eventDate: r.event_date,
        priceCap: r.price_cap,
        drawDone: r.draw_done,
        inviteCode: r.invite_code,
      },
      salt: r.salt,
      wrappedPrivateKey: r.wrapped_private_key,
      wrapIv: r.wrap_iv,
      wishes: wishes.map((w) => ({ title: w.title, price: w.price, link: w.link, details: w.details })),
    });
  });
}
