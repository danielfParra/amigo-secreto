import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { UUID, getGroupStatus, resetGroupDraw } from "@/lib/server/group";
import { HttpError, handle, isUniqueViolation, json, readJson } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";

const SEALED_MAX = 20_000;

/** Stores the ciphertexts the organizer's browser produced. The server cannot read them. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const body = await readJson(req);
    const status = await getGroupStatus(s.groupId);
    if (status.drawDone) throw new HttpError(409, "El sorteo ya se hizo");
    if (!status.canDraw) throw new HttpError(409, "El sorteo todavía no se puede hacer");

    const results = body.results;
    if (!Array.isArray(results) || results.length !== status.members.length) {
      throw new HttpError(422, "El sorteo debe incluir a todas las personas");
    }
    const ids: string[] = [];
    const sealed: string[] = [];
    for (const r of results) {
      const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      if (typeof row.giverId !== "string" || !UUID.test(row.giverId) || typeof row.sealed !== "string" || !row.sealed || row.sealed.length > SEALED_MAX) {
        throw new HttpError(422, "El sorteo no es válido");
      }
      ids.push(row.giverId.toLowerCase());
      sealed.push(row.sealed);
    }
    const members = new Set(status.members.map((m) => m.id));
    if (new Set(ids).size !== ids.length || ids.some((id) => !members.has(id))) {
      throw new HttpError(422, "El sorteo debe incluir a cada persona exactamente una vez");
    }

    try {
      await sql.query(
        `WITH ins AS (
           INSERT INTO results (giver_id, sealed) SELECT * FROM unnest($1::uuid[], $2::text[]) RETURNING 1
         )
         UPDATE groups SET draw_done = true WHERE id = $3 AND draw_done = false`,
        [ids, sealed, s.groupId],
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, "El sorteo ya se hizo");
      throw e;
    }
    return json({ ok: true });
  });
}

/** Organizer only: throws the draw away so it can be redone (for example after someone joins late). */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    await resetGroupDraw(s.groupId);
    return json({ ok: true });
  });
}
