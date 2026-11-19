"use client";

import { useEffect, useState } from "react";
import { clearChatKeys, ensureChatKeys, fetchLines, getSeen, SEEN_UPDATED_EVENT } from "./chat";
import { updateAppBadge } from "./notifications";
import type { Me } from "./useMe";

export type UnreadState = {
  to: boolean;
  from: boolean;
  toCount: number;
  fromCount: number;
  total: number;
  latestToId: number;
  latestFromId: number;
};

const EMPTY: UnreadState = {
  to: false,
  from: false,
  toCount: 0,
  fromCount: 0,
  total: 0,
  latestToId: 0,
  latestFromId: 0,
};

/**
 * Tracks unread messages across both anonymous chat threads.
 * Uses the device key saved at sign-in to unlock the chat keys silently (no PIN prompt).
 */
export function useUnread(me: Me | null | undefined, active = true): UnreadState {
  const [unread, setUnread] = useState<UnreadState>(EMPTY);

  useEffect(() => {
    if (!active || !me || !me.group.drawDone) {
      updateAppBadge(0);
      return;
    }

    const currentMe = me;
    let cancelled = false;
    let lastHiddenCheck = 0;

    async function check(force = false) {
      if (cancelled) return;
      const hidden = typeof document !== "undefined" && document.visibilityState !== "visible";
      if (hidden && !force) {
        const now = Date.now();
        if (now - lastHiddenCheck < 24_000) return;
        lastHiddenCheck = now;
      }

      let keys = await ensureChatKeys(currentMe);
      if (!keys || cancelled) return;

      let [a, b] = await Promise.all([
        fetchLines(keys.toThread, getSeen(keys.toThread.id)),
        fetchLines(keys.fromThread, getSeen(keys.fromThread.id)),
      ]);
      if (cancelled) return;

      // If the draw was redone, refresh chat keys silently from the device key and retry once.
      if ((!a.ok && a.gone) || (!b.ok && b.gone)) {
        clearChatKeys();
        keys = await ensureChatKeys(currentMe);
        if (!keys || cancelled) return;
        [a, b] = await Promise.all([
          fetchLines(keys.toThread, getSeen(keys.toThread.id)),
          fetchLines(keys.fromThread, getSeen(keys.fromThread.id)),
        ]);
        if (cancelled) return;
      }

      const toLines = a.ok ? a.lines.filter((l) => l.role !== "g") : [];
      const fromLines = b.ok ? b.lines.filter((l) => l.role !== "r") : [];
      const toCount = toLines.length;
      const fromCount = fromLines.length;
      const total = toCount + fromCount;
      const latestToId = toLines.length ? toLines[toLines.length - 1].id : 0;
      const latestFromId = fromLines.length ? fromLines[fromLines.length - 1].id : 0;

      updateAppBadge(total);
      setUnread({
        to: toCount > 0,
        from: fromCount > 0,
        toCount,
        fromCount,
        total,
        latestToId,
        latestFromId,
      });
    }

    void check(true);
    const interval = setInterval(() => void check(false), 8000);
    const onRefresh = () => void check(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check(true);
    };

    window.addEventListener("focus", onRefresh);
    window.addEventListener(SEEN_UPDATED_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener(SEEN_UPDATED_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, me]);

  return active && me?.group.drawDone ? unread : EMPTY;
}
