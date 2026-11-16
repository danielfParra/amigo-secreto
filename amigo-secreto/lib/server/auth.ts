import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

function scryptAsync(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, 32, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** The server stores only this hash of the client-derived auth secret, never the PIN. */
export async function hashAuthSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(secret, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyAuthSecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(secret, Buffer.from(saltB64, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Stable fake salt for unknown emails, so /api/salt does not reveal which emails exist. */
export function fakeSalt(email: string): string {
  const key = process.env.SALT_SECRET;
  if (!key) throw new Error("SALT_SECRET is not set");
  return createHmac("sha256", key).update(email.trim().toLowerCase()).digest().subarray(0, 16).toString("base64");
}
