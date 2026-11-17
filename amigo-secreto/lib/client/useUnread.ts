"use client";

import { useEffect, useState } from "react";
import { fetchLines, getSeen, loadChatKeys } from "./chat";

/** Which of your two chats has a message you have not read. Needs the chat keys (so only after you opened the chat this visit). */
export function useUnread(userId: string | undefined, active = true): { to: boolean; from: boolean } {
  const [unread, setUnread] = useState({ to: false, from: false });

  useEffect(() => {
    if (!active || !userId) return;
    let cancelled = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      const keys = loadChatKeys(userId as string);
      if (!keys) return;
      const [a, b] = await Promise.all([
        fetchLines(keys.toThread, getSeen(keys.toThread.id)),
        fetchLines(keys.fromThread, getSeen(keys.fromThread.id)),
      ]);
      if (cancelled) return;
      setUnread({
        to: a.ok && a.lines.some((l) => l.role !== "g"), // I give: the other side writes as "r"
        from: b.ok && b.lines.some((l) => l.role !== "r"),
      });
    }
    void check();
    const t = setInterval(check, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [active, userId]);

  return unread;
}
