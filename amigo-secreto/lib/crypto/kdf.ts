import { fromB64, toB64 } from "./encoding";

export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PIN_LENGTH = 4;

export function newSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

const enc = new TextEncoder();

/**
 * One PBKDF2-SHA256 derivation (32 bytes), then HKDF-SHA256 splits it into two
 * independent secrets: a non-extractable AES-GCM wrap key (stays in the browser)
 * and an auth secret (sent to the server, which stores only a hash of it).
 */
export async function deriveSecrets(
  pin: string,
  saltB64: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<{ authSecret: string; wrapKey: CryptoKey }> {
  if (pin.length < MIN_PIN_LENGTH) throw new Error(`El PIN debe tener al menos ${MIN_PIN_LENGTH} caracteres`);
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const master = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations },
    base,
    256,
  );
  const hkdf = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits"]);
  const derive = (info: string) =>
    crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(info) },
      hkdf,
      256,
    );
  const wrapBits = await derive("wrap");
  const authBits = await derive("auth");
  const wrapKey = await crypto.subtle.importKey("raw", wrapBits, "AES-GCM", false, ["wrapKey", "unwrapKey"]);
  return { authSecret: toB64(new Uint8Array(authBits)), wrapKey };
}
