const DISMISSED_KEY = "amigo-notif-dismissed";
const NOTIFIED_KEY = "amigo-notified-ids";
const BASE_TITLE = "Amigo secreto";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function isNotificationPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissNotificationPrompt() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Updates the browser tab title and, where supported (iOS/Android/Desktop PWAs), the app icon badge. */
export function updateAppBadge(count: number) {
  if (typeof document !== "undefined") {
    document.title = count > 0 ? `(${count}) ${BASE_TITLE}` : BASE_TITLE;
  }
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && typeof nav.setAppBadge === "function") {
      void nav.setAppBadge(count).catch(() => {});
    } else if (count === 0 && typeof nav.clearAppBadge === "function") {
      void nav.clearAppBadge().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/** Privacy-preserving Spanish summary of unread messages (never reveals names or message text). */
export function describeUnread(toCount: number, fromCount: number): string {
  const total = toCount + fromCount;
  if (total <= 0) return "";
  if (toCount > 0 && fromCount > 0) {
    return `Tienes ${total} mensajes nuevos en el chat anónimo`;
  }
  if (fromCount > 0) {
    return fromCount === 1
      ? "Quien te regala te escribió un mensaje"
      : `Quien te regala te escribió ${fromCount} mensajes`;
  }
  return toCount === 1
    ? "Tu amigo secreto te respondió en el chat"
    : `Tu amigo secreto te escribió ${toCount} mensajes`;
}

type NotifiedIds = { toId: number; fromId: number };

function readNotifiedIds(): NotifiedIds {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return { toId: 0, fromId: 0 };
    const parsed = JSON.parse(raw) as Partial<NotifiedIds>;
    return { toId: Number(parsed.toId) || 0, fromId: Number(parsed.fromId) || 0 };
  } catch {
    return { toId: 0, fromId: 0 };
  }
}

function writeNotifiedIds(ids: NotifiedIds) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function clearNotifiedIds() {
  try {
    localStorage.removeItem(NOTIFIED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Checks whether `latestToId` or `latestFromId` is newer than the last notified message.
 * If so, marks them as notified, sends a browser/OS notification when permitted, and returns `true`.
 */
export async function notifyIfNewMessages(opts: {
  toCount: number;
  fromCount: number;
  latestToId: number;
  latestFromId: number;
  sendSystemNotification?: boolean;
}): Promise<boolean> {
  const { toCount, fromCount, latestToId, latestFromId, sendSystemNotification = true } = opts;
  const total = toCount + fromCount;
  if (total <= 0) return false;

  const prev = readNotifiedIds();
  const hasNewTo = toCount > 0 && latestToId > prev.toId;
  const hasNewFrom = fromCount > 0 && latestFromId > prev.fromId;
  if (!hasNewTo && !hasNewFrom) return false;

  writeNotifiedIds({
    toId: Math.max(prev.toId, latestToId),
    fromId: Math.max(prev.fromId, latestFromId),
  });

  if (sendSystemNotification && getNotificationPermission() === "granted") {
    const body = describeUnread(toCount, fromCount);
    const tab = hasNewFrom && !hasNewTo ? "from" : hasNewTo && !hasNewFrom ? "to" : fromCount > 0 ? "from" : "to";
    const url = `/chat?tab=${tab}`;
    const options: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "amigo-chat-unread",
      renotify: true,
      data: { url },
    };

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === "function") {
          await reg.showNotification(BASE_TITLE, options);
          return true;
        }
      }
      const n = new Notification(BASE_TITLE, options);
      n.onclick = () => {
        window.focus();
        window.open(new URL(url, window.location.origin).toString(), "_self");
        n.close();
      };
    } catch {
      /* ignore notification delivery errors */
    }
  }

  return true;
}
