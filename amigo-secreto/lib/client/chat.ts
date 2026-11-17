import { openPayload } from "@/lib/crypto/hybrid";
import { openMessage, sealMessage, type Role, type Thread } from "@/lib/crypto/chat";
import { apiFetch } from "./api";
import { unlockPrivateKey } from "./session";
import type { Me } from "./useMe";

/** Everything needed to chat: the thread with the person you give to, and the thread with whoever gives to you. */
export type ChatKeys = { toThread: Thread; fromThread: Thread; receiverName: string };
export type ChatLine = { id: number; role: Role; text: string; at: number };

const STORE = "amigo-chat-keys";

/** Kept only for this browser tab (sessionStorage) and only for the person who unlocked them, so you type your PIN once per visit. */
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
    /* private mode: the PIN is asked again next time */
  }
}

/** Forgets the keys (logout, or a chat that no longer exists after a redraw). */
export function clearChatKeys() {
  try {
    sessionStorage.removeItem(STORE);
  } catch {
    /* ignore */
  }
}

/** Opens your private key with your PIN and reads both of your chat keys. Throws if the PIN is wrong. */
export async function unlockChat(me: Me, pin: string): Promise<ChatKeys> {
  const key = await unlockPrivateKey(pin, me, me.salt);
  const [r, i] = await Promise.all([apiFetch<{ sealed: string }>("/api/result"), apiFetch<{ sealed: string }>("/api/inbox")]);
  if (!r.ok) throw new Error(r.error);
  if (!i.ok) throw new Error(i.error);
  const given = await openPayload<{ receiverName: string; thread?: Thread }>(r.data.sealed, key);
  const received = await openPayload<{ thread?: Thread }>(i.data.sealed, key);
  if (!given.thread || !received.thread) throw new Error("Este sorteo es anterior al chat. Pide que lo repitan.");
  return { toThread: given.thread, fromThread: received.thread, receiverName: given.receiverName };
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
    if (id > getSeen(threadId)) localStorage.setItem(`amigo-seen-${threadId}`, String(id));
  } catch {
    /* ignore */
  }
}
