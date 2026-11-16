import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { hashAuthSecret } from "@/lib/server/auth";
import { parseCredentials } from "@/lib/server/account";
import { UUID } from "@/lib/server/group";
import { HttpError, handle, json, readJson } from "@/lib/server/http";
import { attachSession, createSession } from "@/lib/server/session";

const CLOSED = () => new HttpError(403, "No hay un restablecimiento de PIN abierto para este nombre");

/**
 * Public, but only works for a member whose organizer opened a reset (and only until it expires or is used).
 * The person sends brand-new credentials: a new salt, auth secret and key pair made from their new PIN.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const c = await parseCredentials(body);
    const memberId = typeof body.memberId === "string" ? body.memberId.toLowerCase() : "";
    if (!UUID.test(memberId)) throw CLOSED();
    const authHash = await hashAuthSecret(c.authSecret);
    // One atomic statement: the reset can be used exactly once, and only while it is open.
    const rows = await sql`
      UPDATE users SET
        salt = ${c.salt}, auth_hash = ${authHash}, public_key = ${c.publicKey},
        wrapped_private_key = ${c.wrappedPrivateKey}, wrap_iv = ${c.wrapIv},
        pin_reset_until = NULL, failed_attempts = 0, locked_until = NULL
      WHERE id = ${memberId} AND auth_hash IS NOT NULL AND pin_reset_until IS NOT NULL AND pin_reset_until > now()
      RETURNING id`;
    if (!rows.length) throw CLOSED();
    const token = await createSession(rows[0].id as string);
    return attachSession(json({ ok: true }), token);
  });
}
