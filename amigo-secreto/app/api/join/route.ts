import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { hashAuthSecret } from "@/lib/server/auth";
import { parseAccount } from "@/lib/server/account";
import { HttpError, handle, isUniqueViolation, json, readJson, text } from "@/lib/server/http";
import { attachSession, createSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const code = text(body, "inviteCode", { max: 20, label: "el código de invitación" }).toUpperCase();
    const a = await parseAccount(body);

    const groups = await sql`SELECT id, draw_done FROM groups WHERE invite_code = ${code}`;
    if (!groups.length) throw new HttpError(404, "No encontramos ese grupo");
    const taken = await sql`SELECT 1 FROM users WHERE email = ${a.email}`;
    if (taken.length) throw new HttpError(409, "Ese correo ya tiene una cuenta", { field: "email" });

    const userId = randomUUID();
    const authHash = await hashAuthSecret(a.authSecret);
    let inserted;
    try {
      // The capacity and "draw not done" checks live in the INSERT itself, so two people joining at once cannot overfill.
      inserted = await sql`
        INSERT INTO users (id, group_id, name, email, salt, auth_hash, public_key, wrapped_private_key, wrap_iv)
        SELECT ${userId}, g.id, ${a.name}, ${a.email}, ${a.salt}, ${authHash}, ${a.publicKey}, ${a.wrappedPrivateKey}, ${a.wrapIv}
        FROM groups g
        WHERE g.id = ${groups[0].id as string}
          AND g.draw_done = false
          AND (SELECT count(*) FROM users u WHERE u.group_id = g.id) < g.expected_size
        RETURNING id`;
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, "Ese correo ya tiene una cuenta", { field: "email" });
      throw e;
    }
    if (!inserted.length) {
      throw new HttpError(
        409,
        groups[0].draw_done ? "El sorteo ya se hizo; pídele a quien organiza que lo rehaga" : "El grupo ya está completo",
      );
    }
    const token = await createSession(userId);
    return attachSession(json({ ok: true }, 201), token);
  });
}
