import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { UUID, resetGroupDraw } from "@/lib/server/group";
import { HttpError, handle, json } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";

/** Organizer only: removes a member (for example someone who dropped out, or forgot their PIN) and reopens the draw. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireOrganizer(_req);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(404, "No encontramos a esa persona");
    if (id.toLowerCase() === s.userId) throw new HttpError(422, "No puedes quitarte a ti mismo");
    const rows = await sql`SELECT 1 FROM users WHERE id = ${id} AND group_id = ${s.groupId}`;
    if (!rows.length) throw new HttpError(404, "No encontramos a esa persona");

    await resetGroupDraw(s.groupId); // every other result was made for a group that no longer exists
    await sql`DELETE FROM users WHERE id = ${id}`;
    return json({ ok: true });
  });
}
