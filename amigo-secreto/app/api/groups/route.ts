import { randomInt, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { hashAuthSecret } from "@/lib/server/auth";
import { parseAccount } from "@/lib/server/account";
import { HttpError, handle, int, isUniqueViolation, json, readJson, text } from "@/lib/server/http";
import { attachSession, createSession, requireOrganizer } from "@/lib/server/session";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const inviteCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const groupName = text(body, "groupName", { max: 80, label: "el nombre del grupo" });
    const priceCap = int(body, "priceCap", { min: 1000, max: 100_000_000, label: "El tope de precio" });
    const expectedSize = int(body, "expectedSize", { min: 2, max: 50, label: "El número de personas" });
    const rawDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
    if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) throw new HttpError(422, "La fecha no es válida", { field: "eventDate" });
    const eventDate = rawDate || null;
    const a = await parseAccount(body);

    const taken = await sql`SELECT 1 FROM users WHERE email = ${a.email}`;
    if (taken.length) throw new HttpError(409, "Ese correo ya tiene una cuenta", { field: "email" });

    const groupId = randomUUID();
    const userId = randomUUID();
    const authHash = await hashAuthSecret(a.authSecret);
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = inviteCode();
      try {
        // One statement, so the group and its organizer are created together or not at all.
        await sql`
          WITH g AS (
            INSERT INTO groups (id, name, event_date, price_cap, expected_size, invite_code, organizer_id)
            VALUES (${groupId}, ${groupName}, ${eventDate}, ${priceCap}, ${expectedSize}, ${code}, ${userId})
            RETURNING id
          )
          INSERT INTO users (id, group_id, name, email, salt, auth_hash, public_key, wrapped_private_key, wrap_iv)
          SELECT ${userId}, g.id, ${a.name}, ${a.email}, ${a.salt}, ${authHash}, ${a.publicKey}, ${a.wrappedPrivateKey}, ${a.wrapIv}
          FROM g`;
        break;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const nowTaken = await sql`SELECT 1 FROM users WHERE email = ${a.email}`;
        if (nowTaken.length) throw new HttpError(409, "Ese correo ya tiene una cuenta", { field: "email" });
        if (attempt === 4) throw e; // invite code collided five times in a row
      }
    }
    const token = await createSession(userId);
    return attachSession(json({ inviteCode: code }, 201), token);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const s = await requireOrganizer(req);
    const body = await readJson(req);
    const expectedSize = int(body, "expectedSize", { min: 2, max: 50, label: "El número de personas" });
    const g = await sql`SELECT draw_done, (SELECT count(*)::int FROM users WHERE group_id = ${s.groupId}) AS members FROM groups WHERE id = ${s.groupId}`;
    if (g[0].draw_done) throw new HttpError(409, "El sorteo ya se hizo");
    if (expectedSize < (g[0].members as number)) {
      throw new HttpError(422, "No puede ser menos que las personas que ya se unieron", { field: "expectedSize" });
    }
    await sql`UPDATE groups SET expected_size = ${expectedSize} WHERE id = ${s.groupId}`;
    return json({ ok: true });
  });
}
