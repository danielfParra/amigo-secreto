import { randomInt, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { nameKey } from "@/lib/names";
import { hashAuthSecret } from "@/lib/server/auth";
import { cleanName, parseCredentials } from "@/lib/server/account";
import { getTheGroup } from "@/lib/server/group";
import { HttpError, handle, int, isUniqueViolation, json, readJson, text } from "@/lib/server/http";
import { attachSession, createSession } from "@/lib/server/session";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const inviteCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const MAX_PEOPLE = 50;

const ALREADY = () => new HttpError(409, "Ya hay un grupo creado. Entra con tu nombre y tu PIN.");

/**
 * Creates the one family group: the roster (every name unclaimed) and the organizer, whose own row is
 * claimed in the very same statement so nobody else can ever claim it.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const groupName = text(body, "groupName", { max: 80, label: "el nombre del grupo" });
    const priceCap = int(body, "priceCap", { min: 1000, max: 100_000_000, label: "El tope de precio" });
    const rawDate = typeof body.eventDate === "string" ? body.eventDate.trim() : "";
    if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) throw new HttpError(422, "La fecha no es válida", { field: "eventDate" });
    const eventDate = rawDate || null;

    if (!Array.isArray(body.names) || body.names.length < 2 || body.names.length > MAX_PEOPLE) {
      throw new HttpError(422, `La lista debe tener entre 2 y ${MAX_PEOPLE} personas`, { field: "names" });
    }
    const names = body.names.map((n) => cleanName(n, "names"));
    if (new Set(names.map(nameKey)).size !== names.length) throw new HttpError(422, "Hay nombres repetidos en la lista", { field: "names" });
    const me = nameKey(cleanName(body.me, "me"));
    const orgIndex = names.findIndex((n) => nameKey(n) === me);
    if (orgIndex < 0) throw new HttpError(422, "Tu nombre tiene que estar en la lista", { field: "me" });
    const c = await parseCredentials(body);

    if (await getTheGroup()) throw ALREADY();

    const groupId = randomUUID();
    const ids = names.map(() => randomUUID());
    const authHash = await hashAuthSecret(c.authSecret);
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = inviteCode();
      try {
        // One statement: the group and its whole roster exist together or not at all.
        await sql.query(
          `WITH g AS (
             INSERT INTO groups (id, name, event_date, price_cap, invite_code, organizer_id)
             VALUES ($1::uuid, $2, $3::date, $4, $5, $6::uuid) RETURNING id
           )
           INSERT INTO users (id, group_id, name, salt, auth_hash, public_key, wrapped_private_key, wrap_iv)
           SELECT x.id, g.id, x.name,
                  CASE WHEN x.org THEN $7::text END, CASE WHEN x.org THEN $8::text END, CASE WHEN x.org THEN $9::text END,
                  CASE WHEN x.org THEN $10::text END, CASE WHEN x.org THEN $11::text END
           FROM g, unnest($12::uuid[], $13::text[], $14::boolean[]) AS x(id, name, org)`,
          [
            groupId, groupName, eventDate, priceCap, code, ids[orgIndex],
            c.salt, authHash, c.publicKey, c.wrappedPrivateKey, c.wrapIv,
            ids, names, names.map((_, i) => i === orgIndex),
          ],
        );
        break;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        if (await getTheGroup()) throw ALREADY(); // someone else created it first
        if (attempt === 4) throw e; // the invite code collided five times in a row
      }
    }
    const token = await createSession(ids[orgIndex]);
    return attachSession(json({ inviteCode: code }, 201), token);
  });
}
