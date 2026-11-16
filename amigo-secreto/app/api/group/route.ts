import type { NextRequest } from "next/server";
import { getGroupStatus } from "@/lib/server/group";
import { handle, json } from "@/lib/server/http";
import { requireSession } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const s = await requireSession(req);
    return json(await getGroupStatus(s.groupId));
  });
}
