import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { UUID, getGroupStatus, resetGroupDraw } from "@/lib/server/group";
import { HttpError, handle, isUniqueViolation, json, readJson } from "@/lib/server/http";
import { requireOrganizer } from "@/lib/server/session";
import { THREAD_HASH } from "@/lib/server/chat";

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

    // Chat records: one sealed inbox entry per receiver and one thread hash per pair; none says who is paired with whom.
    const inbox = body.inbox;
    const threads = body.threads;
    if (!Array.isArray(inbox) || inbox.length !== status.members.length || !Array.isArray(threads) || threads.length !== status.members.length) {
      throw new HttpError(422, "El sorteo debe incluir los chats");
    }
    const inboxIds: string[] = [];
    const inboxSealed: string[] = [];
    for (const r of inbox) {
      const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      if (typeof row.userId !== "string" || !UUID.test(row.userId) || typeof row.sealed !== "string" || !row.sealed || row.sealed.length > SEALED_MAX) {
        throw new HttpError(422, "El sorteo no es válido");
      }
      inboxIds.push(row.userId.toLowerCase());
      inboxSealed.push(row.sealed);
    }
    if (new Set(inboxIds).size !== inboxIds.length || inboxIds.some((id) => !members.has(id))) {
      throw new HttpError(422, "El sorteo debe incluir a cada persona exactamente una vez");
    }
    const hashes = threads as unknown[];
    if (hashes.some((h) => typeof h !== "string" || !THREAD_HASH.test(h)) || new Set(hashes).size !== hashes.length) {
      throw new HttpError(422, "El sorteo no es válido");
    }

    try {
      await sql.query(
        `WITH ins AS (
           INSERT INTO results (giver_id, sealed) SELECT * FROM unnest($1::uuid[], $2::text[]) RETURNING 1
         ), inb AS (
           INSERT INTO inbox (user_id, sealed) SELECT * FROM unnest($4::uuid[], $5::text[]) RETURNING 1
         ), thr AS (
           INSERT INTO chat_threads (thread_hash) SELECT unnest($6::text[]) RETURNING 1
         )
         UPDATE groups SET draw_done = true WHERE id = $3 AND draw_done = false`,
        [ids, sealed, s.groupId, inboxIds, inboxSealed, hashes],
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
