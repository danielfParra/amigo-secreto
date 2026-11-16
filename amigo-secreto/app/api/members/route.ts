import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { cleanName } from "@/lib/server/account";
import { resetGroupDraw } from "@/lib/server/group";
import { HttpError, handle, isUniqueViolation, json, readJson } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";

const MAX_PEOPLE = 50;

/** Organizer only: adds a person to the roster. The new name starts unclaimed, and any finished draw is reopened. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const body = await readJson(req);
    const name = cleanName(body.name);
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users WHERE group_id = ${s.groupId}`;
    if ((n as number) >= MAX_PEOPLE) throw new HttpError(422, `El grupo no puede pasar de ${MAX_PEOPLE} personas`);
    try {
      await sql`INSERT INTO users (group_id, name) VALUES (${s.groupId}, ${name})`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, "Ya hay alguien con ese nombre", { field: "name" });
      throw e;
    }
    await resetGroupDraw(s.groupId); // the new person is not in the draw, so it has to be redone
    return json({ ok: true }, 201);
  });
}
