import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { LOCK_MINUTES, MAX_ATTEMPTS, hashAuthSecret, verifyAuthSecret } from "@/lib/server/auth";
import { HttpError, email, handle, json, readJson, text } from "@/lib/server/http";
import { attachSession, createSession } from "@/lib/server/session";

const LOCKED = () => new HttpError(423, `Demasiados intentos. Intenta de nuevo en ${LOCK_MINUTES} minutos.`);
const BAD = () => new HttpError(401, "Correo o PIN incorrectos");

let dummyHash: Promise<string> | null = null;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const mail = email(body);
    const secret = text(body, "authSecret", { max: 128, label: "la clave de acceso" });

    const rows = await sql`
      SELECT id, auth_hash,
             (locked_until IS NOT NULL AND locked_until > now()) AS locked,
             (pin_reset_until IS NOT NULL AND pin_reset_until > now()) AS reset
      FROM users WHERE email = ${mail}`;
    const u = rows[0];
    if (!u) {
      // Spend the same time as a real check so response time does not reveal which emails exist.
      await verifyAuthSecret(secret, await (dummyHash ??= hashAuthSecret("dummy")));
      throw BAD();
    }
    if (u.reset) {
      throw new HttpError(403, "Tu organizador restableció tu PIN. Elige uno nuevo para entrar.", { resetRequired: true });
    }
    if (u.locked) throw LOCKED();

    if (!(await verifyAuthSecret(secret, u.auth_hash as string))) {
      const r = await sql`
        UPDATE users SET
          failed_attempts = CASE WHEN failed_attempts + 1 >= ${MAX_ATTEMPTS} THEN 0 ELSE failed_attempts + 1 END,
          locked_until = CASE WHEN failed_attempts + 1 >= ${MAX_ATTEMPTS} THEN now() + (${LOCK_MINUTES} * interval '1 minute') ELSE locked_until END
        WHERE id = ${u.id as string}
        RETURNING (locked_until IS NOT NULL AND locked_until > now()) AS locked`;
      throw r[0]?.locked ? LOCKED() : BAD();
    }

    await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${u.id as string}`;
    const token = await createSession(u.id as string);
    return attachSession(json({ ok: true }), token);
  });
}
