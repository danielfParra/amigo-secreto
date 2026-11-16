import { fromB64, toB64 } from "./encoding";

export const PAD_SIZE = 4096;

export class PayloadTooLargeError extends Error {
  constructor() {
    super(`Payload exceeds ${PAD_SIZE - 4} bytes`);
    this.name = "PayloadTooLargeError";
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** True if the payload (as UTF-8 JSON) fits in one padded block. Same rule `sealPayload` enforces. */
export function payloadFits(payload: object): boolean {
  return enc.encode(JSON.stringify(payload)).length <= PAD_SIZE - 4;
}

/** 4-byte big-endian length + JSON bytes + zero fill, always exactly PAD_SIZE bytes. */
function pad(payload: object): Uint8Array<ArrayBuffer> {
  const json = enc.encode(JSON.stringify(payload));
  if (json.length > PAD_SIZE - 4) throw new PayloadTooLargeError();
  const out = new Uint8Array(PAD_SIZE);
  new DataView(out.buffer).setUint32(0, json.length);
  out.set(json, 4);
  return out;
}

function unpad<T>(bytes: Uint8Array): T {
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  return JSON.parse(dec.decode(bytes.subarray(4, 4 + len))) as T;
}

/** Hybrid encryption: fresh AES-GCM key encrypts the padded payload; RSA-OAEP wraps that key. */
export async function sealPayload(payload: object, pub: CryptoKey): Promise<string> {
  const padded = pad(payload);
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, padded);
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  const k = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, rawKey);
  return JSON.stringify({ k: toB64(new Uint8Array(k)), iv: toB64(iv), ct: toB64(new Uint8Array(ct)) });
}

export async function openPayload<T>(sealed: string, priv: CryptoKey): Promise<T> {
  const { k, iv, ct } = JSON.parse(sealed) as { k: string; iv: string; ct: string };
  const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, fromB64(k));
  const aesKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const padded = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, aesKey, fromB64(ct));
  return unpad<T>(new Uint8Array(padded));
}
