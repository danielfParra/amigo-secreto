import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { hashAuthSecret } from "@/lib/server/auth";
import { parseCredentials } from "@/lib/server/account";
import { UUID } from "@/lib/server/group";
import { HttpError, handle, json, readJson, text } from "@/lib/server/http";
import { attachSession, createSession } from "@/lib/server/session";

/** A person picks their name on the invite page and chooses a PIN: their roster row gets its credentials. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const code = text(body, "inviteCode", { max: 20, label: "el código de invitación" }).toUpperCase();
    const memberId = typeof body.memberId === "string" ? body.memberId.toLowerCase() : "";
    const c = await parseCredentials(body);
    if (!UUID.test(memberId)) throw new HttpError(404, "No encontramos ese nombre en la lista");

    const authHash = await hashAuthSecret(c.authSecret);
    // Claiming is one atomic UPDATE that only succeeds while the name is still unclaimed.
    const claimed = await sql`
      UPDATE users u SET salt = ${c.salt}, auth_hash = ${authHash}, public_key = ${c.publicKey},
                         wrapped_private_key = ${c.wrappedPrivateKey}, wrap_iv = ${c.wrapIv}
      FROM groups g
      WHERE u.id = ${memberId} AND g.id = u.group_id AND g.invite_code = ${code} AND u.auth_hash IS NULL
      RETURNING u.id`;
    if (!claimed.length) {
      const why = await sql`
        SELECT u.id AS uid, (u.auth_hash IS NOT NULL) AS taken
        FROM groups g LEFT JOIN users u ON u.id = ${memberId} AND u.group_id = g.id
        WHERE g.invite_code = ${code}`;
      if (!why.length) throw new HttpError(404, "No encontramos ese grupo");
      if (!why[0].uid) throw new HttpError(404, "No encontramos ese nombre en la lista");
      throw new HttpError(409, "Ese nombre ya fue elegido. Si eres tú, entra con tu PIN.");
    }
    const token = await createSession(memberId);
    return attachSession(json({ ok: true }, 201), token);
  });
}
