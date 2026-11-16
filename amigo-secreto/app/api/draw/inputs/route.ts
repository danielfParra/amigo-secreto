import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getGroupStatus } from "@/lib/server/group";
import { HttpError, handle, json } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";

/** Organizer only, and only once the draw is possible: everything their browser needs to run it. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const status = await getGroupStatus(s.groupId);
    if (!status.canDraw) throw new HttpError(409, "El sorteo todavía no se puede hacer");

    const users = await sql`SELECT id, name, public_key FROM users WHERE group_id = ${s.groupId} ORDER BY created_at`;
    const wishes = await sql`
      SELECT w.user_id, w.title, w.price, w.link FROM wishes w
      JOIN users u ON u.id = w.user_id WHERE u.group_id = ${s.groupId} ORDER BY w.user_id, w.position`;
    return json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        publicKey: u.public_key,
        wishes: wishes
          .filter((w) => w.user_id === u.id)
          .map((w) => ({ title: w.title, price: w.price, ...(w.link ? { link: w.link } : {}) })),
      })),
    );
  });
}
