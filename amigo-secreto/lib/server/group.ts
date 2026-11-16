import { sql } from "@/lib/db";

export type GroupStatus = {
  members: { id: string; name: string; ready: boolean; resetPending: boolean }[];
  expectedSize: number;
  readyCount: number;
  drawDone: boolean;
  canDraw: boolean;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who has joined, whose list is complete, and whether the draw can run. Never includes keys or wishes. */
export async function getGroupStatus(groupId: string): Promise<GroupStatus> {
  const [g] = await sql`SELECT expected_size, draw_done FROM groups WHERE id = ${groupId}`;
  const rows = await sql`
    SELECT u.id, u.name,
           (SELECT count(*) FROM wishes w WHERE w.user_id = u.id) = 3 AS ready,
           (u.pin_reset_until IS NOT NULL AND u.pin_reset_until > now()) AS reset_pending
    FROM users u WHERE u.group_id = ${groupId}
    ORDER BY lower(u.name), u.created_at`;
  const members = rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    ready: r.ready as boolean,
    resetPending: r.reset_pending as boolean,
  }));
  const expectedSize = g.expected_size as number;
  const drawDone = g.draw_done as boolean;
  const readyCount = members.filter((m) => m.ready).length;
  return {
    members,
    expectedSize,
    readyCount,
    drawDone,
    // A member with an open PIN reset still has their old public key; sealing to it would make their result unreadable.
    canDraw:
      !drawDone && members.length === expectedSize && readyCount === members.length && !members.some((m) => m.resetPending),
  };
}

/** Deletes every draw result of the group and reopens it. */
export async function resetGroupDraw(groupId: string): Promise<void> {
  await sql`DELETE FROM results WHERE giver_id IN (SELECT id FROM users WHERE group_id = ${groupId})`;
  await sql`UPDATE groups SET draw_done = false WHERE id = ${groupId}`;
}
