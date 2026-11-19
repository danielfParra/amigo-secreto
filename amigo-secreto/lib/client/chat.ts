import { openPayload } from "@/lib/crypto/hybrid";
import { openMessage, sealMessage, type Role, type Thread } from "@/lib/crypto/chat";
import { apiFetch } from "./api";
import { unlockAndRememberPrivateKey, unlockPrivateKeyFromDevice } from "./session";
import type { Me } from "./useMe";

/** Everything needed to chat: the thread with the person you give to, and the thread with whoever gives to you. */
export type ChatKeys = { toThread: Thread; fromThread: Thread; receiverName: string };
export type ChatLine = { id: number; role: Role; text: string; at: number };

const STORE = "amigo-chat-keys";
export const SEEN_UPDATED_EVENT = "amigo-seen-updated";

/** Cached for the active tab (sessionStorage) so switching pages avoids re-fetching /api/result and /api/inbox. */
export function loadChatKeys(userId: string): ChatKeys | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { userId?: string; keys?: ChatKeys };
    return saved.userId === userId && saved.keys ? saved.keys : null;
  } catch {
    return null;
  }
}

export function saveChatKeys(userId: string, k: ChatKeys) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ userId, keys: k }));
  } catch {
    /* private mode: keys will be re-derived silently from the device key when available */
  }
}

/** Forgets the cached chat keys (logout, or a chat that no longer exists after a redraw). */
export function clearChatKeys() {
  try {
    sessionStorage.removeItem(STORE);
  } catch {
    /* ignore */
  }
}

/** Reads both chat threads using an already-unlocked private key. */
export async function unlockChatWithKey(key: CryptoKey): Promise<ChatKeys> {
  const [r, i] = await Promise.all([apiFetch<{ sealed: string }>("/api/result"), apiFetch<{ sealed: string }>("/api/inbox")]);
  if (!r.ok) throw new Error(r.error);
  if (!i.ok) throw new Error(i.error);
  const given = await openPayload<{ receiverName: string; thread?: Thread }>(r.data.sealed, key);
  const received = await openPayload<{ thread?: Thread }>(i.data.sealed, key);
  if (!given.thread || !received.thread) throw new Error("Este sorteo es anterior al chat. Pide que lo repitan.");
  return { toThread: given.thread, fromThread: received.thread, receiverName: given.receiverName };
}

/** Opens your private key with your PIN (and remembers the device key) and reads both chat keys. Throws if the PIN is wrong. */
export async function unlockChat(me: Me, pin: string): Promise<ChatKeys> {
  const key = await unlockAndRememberPrivateKey(pin, me);
  return unlockChatWithKey(key);
}

const inflight = new Map<string, Promise<ChatKeys | null>>();

/**
 * Returns the user's chat keys without asking for a PIN by using the cached tab keys or
 * silently unlocking with the non-extractable device key saved at sign-in. Returns `null`
 * only if no device key is present yet (e.g. a session from before this update).
 */
export async function ensureChatKeys(me: Me): Promise<ChatKeys | null> {
  const cached = loadChatKeys(me.user.id);
  if (cached) return cached;
  const existing = inflight.get(me.user.id);
  if (existing) return existing;

  const job = (async () => {
    try {
      const key = await unlockPrivateKeyFromDevice(me);
      if (!key) return null;
      const chatKeys = await unlockChatWithKey(key);
      saveChatKeys(me.user.id, chatKeys);
      return chatKeys;
    } catch {
      return null;
    } finally {
      inflight.delete(me.user.id);
    }
  })();

  inflight.set(me.user.id, job);
  return job;
}

export async function fetchLines(thread: Thread, after: number): Promise<{ ok: true; lines: ChatLine[] } | { ok: false; error: string; gone: boolean }> {
  const r = await apiFetch<{ messages: { id: number; sealed: string }[] }>("/api/chat/read", "POST", { threadId: thread.id, after }, { anonymous: true });
  if (!r.ok) return { ok: false, error: r.error, gone: r.status === 404 };
  const lines: ChatLine[] = [];
  for (const m of r.data.messages) {
    try {
      lines.push({ id: m.id, ...(await openMessage(thread.key, m.sealed)) });
    } catch {
      /* a message that does not open with this key is ignored */
    }
  }
  return { ok: true, lines };
}

export async function sendLine(thread: Thread, role: Role, text: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  let sealed: string;
  try {
    sealed = await sealMessage(thread.key, role, text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No pudimos cifrar el mensaje" };
  }
  const r = await apiFetch<{ id: number }>("/api/chat/send", "POST", { threadId: thread.id, sealed }, { anonymous: true });
  return r.ok ? { ok: true, id: r.data.id } : { ok: false, error: r.error };
}

// "Seen" markers are per device and never leave it.
export function getSeen(threadId: string): number {
  try {
    return Number(localStorage.getItem(`amigo-seen-${threadId}`)) || 0;
  } catch {
    return 0;
  }
}

export function setSeen(threadId: string, id: number) {
  try {
    if (id > getSeen(threadId)) {
      localStorage.setItem(`amigo-seen-${threadId}`, String(id));
      if (typeof window !== "undefined") window.dispatchEvent(new Event(SEEN_UPDATED_EVENT));
    }
  } catch {
    /* ignore */
  }
}
