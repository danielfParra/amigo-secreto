import { DEFAULT_ITERATIONS, deriveSecrets, newSalt } from "@/lib/crypto/kdf";
import { exportPublicKey, generateKeyPair, unwrapPrivateKey, wrapPrivateKey } from "@/lib/crypto/keys";

export type Credentials = {
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

/**
 * A brand-new salt, auth secret and key pair for a PIN. Used when a person claims their name and when
 * they choose a new PIN after a reset. The PIN and the private key never leave the browser.
 */
export async function createCredentials(pin: string, iterations: number = DEFAULT_ITERATIONS): Promise<Credentials> {
  const salt = newSalt();
  const { authSecret, wrapKey } = await deriveSecrets(pin, salt, iterations);
  const kp = await generateKeyPair();
  const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, wrapKey);
  return { salt, authSecret, publicKey: await exportPublicKey(kp.publicKey), wrappedPrivateKey: wrapped, wrapIv: iv };
}

/** At sign-in: the auth secret to send to the server (the wrap key stays in the browser). */
export function loginSecrets(pin: string, saltB64: string, iterations: number = DEFAULT_ITERATIONS) {
  return deriveSecrets(pin, saltB64, iterations);
}

/** Unlocks the stored private key with the PIN. Rejects if the PIN is wrong. The key is never persisted. */
export async function unlockPrivateKey(
  pin: string,
  me: { wrappedPrivateKey: string; wrapIv: string },
  saltB64: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  const { wrapKey } = await deriveSecrets(pin, saltB64, iterations);
  return unwrapPrivateKey(me.wrappedPrivateKey, me.wrapIv, wrapKey);
}
