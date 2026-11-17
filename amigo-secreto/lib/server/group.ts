import { sql } from "@/lib/db";
import { sortNames } from "@/lib/names";

export type GroupStatus = {
  members: { id: string; name: string; claimed: boolean; ready: boolean; resetPending: boolean }[];
  size: number;
  readyCount: number;
  drawDone: boolean;
  canDraw: boolean;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who is on the roster, who has joined, whose list is complete, and whether the draw can run. Never includes keys or wishes. */
export async function getGroupStatus(groupId: string): Promise<GroupStatus> {
  const [g] = await sql`SELECT draw_done FROM groups WHERE id = ${groupId}`;
  const rows = await sql`
    SELECT u.id, u.name,
           (u.auth_hash IS NOT NULL) AS claimed,
           (SELECT count(*) FROM wishes w WHERE w.user_id = u.id) = 3 AS ready,
           (u.pin_reset_until IS NOT NULL AND u.pin_reset_until > now()) AS reset_pending
    FROM users u WHERE u.group_id = ${groupId}`;
  const members = sortNames(
    rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      claimed: r.claimed as boolean,
      ready: r.ready as boolean,
      resetPending: r.reset_pending as boolean,
    })),
    (m) => m.name,
  );
  const drawDone = g.draw_done as boolean;
  return {
    members,
    size: members.length,
    readyCount: members.filter((m) => m.ready).length,
    drawDone,
    // A member with an open PIN reset still has their old public key; sealing to it would make their result unreadable.
    canDraw: !drawDone && members.length >= 2 && members.every((m) => m.claimed && m.ready && !m.resetPending),
  };
}

/** Deletes every draw result, chat record and chat message of the group and reopens it, so a new draw never inherits old chats. */
export async function resetGroupDraw(groupId: string): Promise<void> {
  await sql`DELETE FROM results WHERE giver_id IN (SELECT id FROM users WHERE group_id = ${groupId})`;
  await sql`DELETE FROM inbox WHERE user_id IN (SELECT id FROM users WHERE group_id = ${groupId})`;
  await sql`DELETE FROM chat_threads`; // one family group per app; messages go with their thread
  await sql`UPDATE groups SET draw_done = false WHERE id = ${groupId}`;
}

/** The app serves one family group: this is it (or null before it is created). */
export async function getTheGroup() {
  const rows = await sql`SELECT id, name, event_date::text AS event_date, price_cap, invite_code FROM groups LIMIT 1`;
  return rows[0] ?? null;
}
