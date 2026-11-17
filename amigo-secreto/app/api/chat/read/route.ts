import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { THREAD_MESSAGE_CAP, hashThread, threadIdFrom } from "@/lib/server/chat";
import { HttpError, handle, json, readJson } from "@/lib/server/http";

/** Returns the encrypted messages of a thread after a cursor. Takes no session, for the same reason as send. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson(req);
    const hash = hashThread(threadIdFrom(body));
    const after = typeof body.after === "number" && Number.isInteger(body.after) && body.after >= 0 ? body.after : 0;
    const exists = await sql`SELECT 1 FROM chat_threads WHERE thread_hash = ${hash}`;
    if (!exists.length) throw new HttpError(404, "Este chat ya no existe");
    const rows = await sql`
      SELECT id, sealed FROM chat_messages WHERE thread_hash = ${hash} AND id > ${after} ORDER BY id LIMIT ${THREAD_MESSAGE_CAP}`;
    return json({ messages: rows.map((r) => ({ id: Number(r.id), sealed: r.sealed as string })) });
  });
}
