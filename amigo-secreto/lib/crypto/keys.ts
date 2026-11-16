import { fromB64, toB64 } from "./encoding";

const RSA = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };

export function generateKeyPair(): Promise<CryptoKeyPair> {
  // Extractable so the private key can be wrapped (encrypted) for server-side storage.
  return crypto.subtle.generateKey(RSA, true, ["encrypt", "decrypt"]) as Promise<CryptoKeyPair>;
}

export async function exportPublicKey(k: CryptoKey): Promise<string> {
  return JSON.stringify(await crypto.subtle.exportKey("jwk", k));
}

const PRIVATE_JWK_FIELDS = ["d", "p", "q", "dp", "dq", "qi", "oth"];

/** Imports a public key, refusing anything that is not a genuine RSA-OAEP-256 key of at least 2048 bits. */
export function importPublicKey(s: string): Promise<CryptoKey> {
  const jwk = JSON.parse(s) as JsonWebKey;
  const modulusBytes = typeof jwk.n === "string" ? fromB64(jwk.n.replace(/-/g, "+").replace(/_/g, "/")).length : 0;
  if (
    jwk.kty !== "RSA" ||
    jwk.alg !== "RSA-OAEP-256" ||
    modulusBytes < 256 ||
    PRIVATE_JWK_FIELDS.some((f) => f in jwk)
  ) {
    return Promise.reject(new Error("Clave pública inválida"));
  }
  return crypto.subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
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
