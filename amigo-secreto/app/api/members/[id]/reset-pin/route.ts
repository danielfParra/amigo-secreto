import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { UUID } from "@/lib/server/group";
import { HttpError, handle, json } from "@/lib/server/http";
import { startPinReset } from "@/lib/server/pin-reset";
import { requireOrganizer } from "@/lib/server/session";

/** Organizer only: lets a member who forgot their PIN choose a new one the next time they sign in. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const { id } = await params;
    if (!UUID.test(id)) throw new HttpError(404, "No encontramos a esa persona");
    if (id.toLowerCase() === s.userId) throw new HttpError(422, "Tu propio PIN se restablece desde el script de administración");
    const rows = await sql`SELECT 1 FROM users WHERE id = ${id} AND group_id = ${s.groupId}`;
    if (!rows.length) throw new HttpError(404, "No encontramos a esa persona");
    const { drawReset } = await startPinReset(s.groupId, id);
    return json({ ok: true, drawReset });
  });
}
