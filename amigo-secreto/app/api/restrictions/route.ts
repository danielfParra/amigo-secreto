import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { UUID } from "@/lib/server/group";
import { HttpError, handle, isUniqueViolation, json, readJson } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";

async function ids(req: NextRequest, groupId: string) {
  const body = await readJson(req);
  const { giverId, receiverId } = body;
  if (typeof giverId !== "string" || typeof receiverId !== "string" || !UUID.test(giverId) || !UUID.test(receiverId)) {
    throw new HttpError(422, "La restricción no es válida");
  }
  const g = giverId.toLowerCase();
  const r = receiverId.toLowerCase();
  if (g === r) throw new HttpError(422, "Una persona ya nunca se regala a sí misma");
  const found = await sql`SELECT id FROM users WHERE group_id = ${groupId} AND id = ANY(${[g, r]}::uuid[])`;
  if (found.length !== 2) throw new HttpError(404, "No encontramos a esa persona");
  return { g, r };
}

async function assertBeforeDraw(groupId: string) {
  const [grp] = await sql`SELECT draw_done FROM groups WHERE id = ${groupId}`;
  if (grp.draw_done) throw new HttpError(409, "El sorteo ya se hizo. Para cambiar restricciones, rehaz el sorteo.");
}

/** Organizer only: the "cannot draw" pairs of the group. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const rows = await sql`
      SELECT r.giver_id, r.receiver_id FROM restrictions r JOIN users u ON u.id = r.giver_id WHERE u.group_id = ${s.groupId}`;
    return json(rows.map((r) => ({ giverId: r.giver_id, receiverId: r.receiver_id })));
  });
}

/** Organizer only: adds a pair; before the draw only. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const { g, r } = await ids(req, s.groupId);
    await assertBeforeDraw(s.groupId);
    const [{ n, blocked }] = await sql`
      SELECT (SELECT count(*)::int FROM users WHERE group_id = ${s.groupId}) AS n,
             (SELECT count(*)::int FROM restrictions WHERE giver_id = ${g}) AS blocked`;
    // The giver already cannot draw themselves; this restriction must still leave at least one possible receiver.
    if ((blocked as number) + 2 >= (n as number)) throw new HttpError(422, "Con esa restricción esa persona se quedaría sin nadie a quien regalar");
    try {
      await sql`INSERT INTO restrictions (giver_id, receiver_id) VALUES (${g}, ${r})`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, "Esa restricción ya existe");
      throw e;
    }
    return json({ ok: true }, 201);
  });
}

/** Organizer only: removes a pair; before the draw only. */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const { g, r } = await ids(req, s.groupId);
    await assertBeforeDraw(s.groupId);
    await sql`DELETE FROM restrictions WHERE giver_id = ${g} AND receiver_id = ${r}`;
    return json({ ok: true });
  });
}
