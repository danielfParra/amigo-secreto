import { DEFAULT_ITERATIONS, deriveSecrets, newSalt } from "@/lib/crypto/kdf";
import { exportPublicKey, generateKeyPair, unwrapPrivateKey, wrapPrivateKey } from "@/lib/crypto/keys";
import { clearDeviceWrapKey, loadDeviceWrapKey, saveDeviceWrapKey } from "./deviceKey";

export type Credentials = {
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

/**
 * Like `createCredentials`, but also returns the non-extractable `wrapKey` so the browser can
 * remember it on this device and never ask for the PIN again after signing in.
 */
export async function createCredentialsWithKey(
  pin: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<{ credentials: Credentials; wrapKey: CryptoKey }> {
  const salt = newSalt();
  const { authSecret, wrapKey } = await deriveSecrets(pin, salt, iterations);
  const kp = await generateKeyPair();
  const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, wrapKey);
  return {
    credentials: { salt, authSecret, publicKey: await exportPublicKey(kp.publicKey), wrappedPrivateKey: wrapped, wrapIv: iv },
    wrapKey,
  };
}

/**
 * A brand-new salt, auth secret and key pair for a PIN. Used when a person claims their name and when
 * they choose a new PIN after a reset. The PIN and the private key never leave the browser.
 */
export async function createCredentials(pin: string, iterations: number = DEFAULT_ITERATIONS): Promise<Credentials> {
  return (await createCredentialsWithKey(pin, iterations)).credentials;
}

/** At sign-in: the auth secret to send to the server (the wrap key stays in the browser). */
export function loginSecrets(pin: string, saltB64: string, iterations: number = DEFAULT_ITERATIONS) {
  return deriveSecrets(pin, saltB64, iterations);
}

/** Unlocks the stored private key with the PIN. Rejects if the PIN is wrong. */
export async function unlockPrivateKey(
  pin: string,
  me: { wrappedPrivateKey: string; wrapIv: string },
  saltB64: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  const { wrapKey } = await deriveSecrets(pin, saltB64, iterations);
  return unwrapPrivateKey(me.wrappedPrivateKey, me.wrapIv, wrapKey);
}

/** Unlocks the stored private key using the non-extractable wrapKey remembered on this device, if present. */
export async function unlockPrivateKeyFromDevice(me: {
  user: { id: string };
  wrappedPrivateKey: string;
  wrapIv: string;
}): Promise<CryptoKey | null> {
  const wrapKey = await loadDeviceWrapKey(me.user.id);
  if (!wrapKey) return null;
  try {
    return await unwrapPrivateKey(me.wrappedPrivateKey, me.wrapIv, wrapKey);
  } catch {
    // Key no longer matches (e.g., PIN was reset on another device): clear stale key and fall back.
    await clearDeviceWrapKey();
    return null;
  }
}

/** Unlocks the private key with the PIN and remembers the wrapKey on this device so the PIN is not asked again. */
export async function unlockAndRememberPrivateKey(
  pin: string,
  me: { user: { id: string }; wrappedPrivateKey: string; wrapIv: string; salt: string },
  iterations: number = DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  const { wrapKey } = await deriveSecrets(pin, me.salt, iterations);
  const key = await unwrapPrivateKey(me.wrappedPrivateKey, me.wrapIv, wrapKey);
  await saveDeviceWrapKey(me.user.id, wrapKey);
  return key;
}
