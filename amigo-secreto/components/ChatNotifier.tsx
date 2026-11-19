"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/client/api";
import { describeUnread, notifyIfNewMessages } from "@/lib/client/notifications";
import type { Me } from "@/lib/client/useMe";
import { useUnread } from "@/lib/client/useUnread";

const AUTH_ROUTES = ["/grupo", "/lista", "/privacidad", "/sorteo", "/chat"];

/**
 * App-wide silent watcher on authenticated screens:
 * - Updates the PWA icon badge and browser tab title via `useUnread`
 * - Dispatches OS/browser notifications (when permitted) for genuinely new messages
 * - Shows a salient floating toast banner when a new message arrives while outside `/chat`
 */
export default function ChatNotifier() {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");

  const [me, setMe] = useState<Me | null>(null);
  const [toast, setToast] = useState<{ text: string; href: string } | null>(null);

  useEffect(() => {
    if (!isAuthRoute) return;
    let cancelled = false;
    apiFetch<Me>("/api/me").then((r) => {
      if (!cancelled) setMe(r.ok ? r.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, pathname]);

  const activeMe = isAuthRoute ? me : null;
  const unread = useUnread(activeMe, isAuthRoute && Boolean(activeMe?.group.drawDone));

  useEffect(() => {
    if (!isAuthRoute || !activeMe?.group.drawDone || unread.total === 0) return;
    let cancelled = false;
    const isHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    void notifyIfNewMessages({
      toCount: unread.toCount,
      fromCount: unread.fromCount,
      latestToId: unread.latestToId,
      latestFromId: unread.latestFromId,
      sendSystemNotification: !isChat || isHidden,
    }).then((isNew) => {
      if (cancelled || !isNew || isChat) return;
      const tab = unread.fromCount > 0 && unread.toCount === 0 ? "from" : unread.toCount > 0 && unread.fromCount === 0 ? "to" : "from";
      setToast({
        text: describeUnread(unread.toCount, unread.fromCount),
        href: `/chat?tab=${tab}`,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, isChat, activeMe?.group.drawDone, unread.total, unread.toCount, unread.fromCount, unread.latestToId, unread.latestFromId]);

  const visibleToast = isAuthRoute && !isChat && unread.total > 0 ? toast : null;
  if (!visibleToast) return null;

  return (
    <div className="msg-toast-wrap" role="status" aria-live="polite">
      <div className="msg-toast">
        <span className="msg-toast-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <div className="msg-toast-body">
          <strong>Mensaje nuevo</strong>
          <span>{visibleToast.text}</span>
        </div>
        <Link href={visibleToast.href} className="msg-toast-cta" onClick={() => setToast(null)}>
          Ver
        </Link>
        <button type="button" className="msg-toast-close" aria-label="Cerrar aviso" onClick={() => setToast(null)}>
          ×
        </button>
      </div>
    </div>
  );
}
