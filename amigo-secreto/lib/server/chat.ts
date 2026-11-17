import { createHash } from "node:crypto";
import { HttpError } from "./http";

export const THREAD_ID = /^[0-9a-f]{32}$/;
export const THREAD_HASH = /^[0-9a-f]{64}$/;
export const MESSAGE_SEALED_MAX = 6000;
export const THREAD_MESSAGE_CAP = 300;

/** The server only ever keeps this digest, never the thread id that opens the chat. */
export const hashThread = (threadId: string) => createHash("sha256").update(threadId).digest("hex");

export function threadIdFrom(body: Record<string, unknown>): string {
  const id = body.threadId;
  if (typeof id !== "string" || !THREAD_ID.test(id)) throw new HttpError(422, "Chat no válido");
  return id;
}
