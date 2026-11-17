import { fromB64, toB64 } from "./encoding";

/** One chat thread per gift pair. The id is the capability to read/post it; the key encrypts every message in it. */
export type Thread = { id: string; key: string };
export type Role = "g" | "r"; // g = the person who gives, r = the person who receives

export const MESSAGE_MAX_CHARS = 280;
const MSG_PAD = 2048; // worst case: 280 UTF-16 units, each escaped to 6 bytes in JSON = 1680, plus the envelope
const enc = new TextEncoder();
const dec = new TextDecoder();

export class MessageTooLongError extends Error {
  constructor() {
    super(`El mensaje no puede pasar de ${MESSAGE_MAX_CHARS} caracteres`);
    this.name = "MessageTooLongError";
  }
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export function newThread(): Thread {
  return { id: hex(crypto.getRandomValues(new Uint8Array(16))), key: toB64(crypto.getRandomValues(new Uint8Array(32))) };
}

/** What the server stores to recognise a thread without ever holding its id. */
export async function threadHash(threadId: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(threadId))));
}

const importKey = (key: string, usage: "encrypt" | "decrypt") => crypto.subtle.importKey("raw", fromB64(key), "AES-GCM", false, [usage]);

/** Fixed-size AES-GCM message: role and text live inside the ciphertext, so the server sees neither who wrote it nor how long it was. */
export async function sealMessage(key: string, role: Role, text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) throw new Error("El mensaje está vacío");
  if (clean.length > MESSAGE_MAX_CHARS) throw new MessageTooLongError();
  const json = enc.encode(JSON.stringify({ r: role, t: clean, at: Date.now() }));
  const padded = new Uint8Array(MSG_PAD);
  new DataView(padded.buffer).setUint32(0, json.length);
  padded.set(json, 4);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(key, "encrypt"), padded);
  return JSON.stringify({ iv: toB64(iv), ct: toB64(new Uint8Array(ct)) });
}

export async function openMessage(key: string, sealed: string): Promise<{ role: Role; text: string; at: number }> {
  const { iv, ct } = JSON.parse(sealed) as { iv: string; ct: string };
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await importKey(key, "decrypt"), fromB64(ct)));
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0);
  const m = JSON.parse(dec.decode(padded.subarray(4, 4 + len))) as { r: Role; t: string; at: number };
  return { role: m.r, text: m.t, at: m.at };
}
