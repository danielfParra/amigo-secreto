import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { THREAD_MESSAGE_CAP, MESSAGE_SEALED_MAX, hashThread, threadIdFrom } from "@/lib/server/chat";
import { HttpError, handle, json, readJson } from "@/lib/server/http";

/**
 * Posts an encrypted message. Deliberately takes no session: whoever holds the thread id may post, and nothing in the
 * request or the stored row says who they are.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const hash = hashThread(threadIdFrom(body));
    const sealed = body.sealed;
    if (typeof sealed !== "string" || !sealed || sealed.length > MESSAGE_SEALED_MAX) throw new HttpError(422, "Mensaje no válido");

    const rows = await sql.query(
      `INSERT INTO chat_messages (thread_hash, sealed)
       SELECT $1::text, $2::text WHERE EXISTS (SELECT 1 FROM chat_threads WHERE thread_hash = $1::text)
         AND (SELECT count(*) FROM chat_messages WHERE thread_hash = $1::text) < $3::int
       RETURNING id`,
      [hash, sealed, THREAD_MESSAGE_CAP],
    );
    if (!rows.length) {
      const exists = await sql`SELECT 1 FROM chat_threads WHERE thread_hash = ${hash}`;
      if (!exists.length) throw new HttpError(404, "Este chat ya no existe");
      throw new HttpError(409, "Este chat llegó a su límite de mensajes");
    }
    return json({ id: Number(rows[0].id) }, 201);
  });
}
