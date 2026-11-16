import { fromB64, toB64 } from "./encoding";

const RSA = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

export function generateKeyPair(): Promise<CryptoKeyPair> {
  // Extractable so the private key can be wrapped (encrypted) for server-side storage.
  return crypto.subtle.generateKey(RSA, true, ["encrypt", "decrypt"]) as Promise<CryptoKeyPair>;
}

export async function exportPublicKey(k: CryptoKey): Promise<string> {
  return JSON.stringify(await crypto.subtle.exportKey("jwk", k));
}

export function importPublicKey(s: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", JSON.parse(s), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
}

export async function wrapPrivateKey(
  priv: CryptoKey,
  wrapKey: CryptoKey,
): Promise<{ wrapped: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey("pkcs8", priv, wrapKey, { name: "AES-GCM", iv });
  return { wrapped: toB64(new Uint8Array(wrapped)), iv: toB64(iv) };
}

export function unwrapPrivateKey(wrapped: string, iv: string, wrapKey: CryptoKey): Promise<CryptoKey> {
  // Unwrapped as non-extractable: the decrypted key can be used but never exported again.
  return crypto.subtle.unwrapKey(
    "pkcs8",
    fromB64(wrapped),
    wrapKey,
    { name: "AES-GCM", iv: fromB64(iv) },
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}
