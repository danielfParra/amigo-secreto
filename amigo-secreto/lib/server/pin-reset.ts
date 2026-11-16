import { sql } from "@/lib/db";
import { resetGroupDraw } from "./group";

export const PIN_RESET_DAYS = 3;

/**
 * Opens a PIN reset for one member: their sessions end, lockouts clear, and for the next
 * PIN_RESET_DAYS days they can choose a new PIN. The old PIN protects their private key and cannot
 * be recovered, so they get a new key pair; if the draw was already done, their result is lost with
 * the old key and the whole draw is reopened. Wishes are kept.
 */
export async function startPinReset(groupId: string, userId: string): Promise<{ drawReset: boolean }> {
  await sql`
    UPDATE users
    SET pin_reset_until = now() + (${PIN_RESET_DAYS} * interval '1 day'), failed_attempts = 0, locked_until = NULL
    WHERE id = ${userId}`;
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
  const [g] = await sql`SELECT draw_done FROM groups WHERE id = ${groupId}`;
  const drawReset = g.draw_done === true;
  if (drawReset) await resetGroupDraw(groupId);
  return { drawReset };
}
