import { NextRequest } from "next/server";
import { newSalt, deriveSecrets } from "@/lib/crypto/kdf";
import { generateKeyPair, exportPublicKey, wrapPrivateKey } from "@/lib/crypto/keys";

export const IT = 1000; // low PBKDF2 iterations for fast tests

export function mkReq(method: string, path: string, body?: unknown, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** `session=<token>` from a Set-Cookie on a handler response. */
export function sessionCookie(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const m = header.match(/session=([^;]*)/);
  return m && m[1] ? `session=${m[1]}` : "";
}

export type Account = {
  name: string;
  email: string;
  pin: string;
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
  privateKey: CryptoKey;
  fields: {
    name: string;
    email: string;
    salt: string;
    authSecret: string;
    publicKey: string;
    wrappedPrivateKey: string;
    wrapIv: string;
  };
};

/** Builds what a browser sends when it creates an account (keys generated client-side). */
export async function makeAccount(name: string, email: string, pin = "1234"): Promise<Account> {
  const salt = newSalt();
  const { authSecret, wrapKey } = await deriveSecrets(pin, salt, IT);
  const kp = await generateKeyPair();
  const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, wrapKey);
  const publicKey = await exportPublicKey(kp.publicKey);
  return {
    name,
    email,
    pin,
    salt,
    authSecret,
    publicKey,
    wrappedPrivateKey: wrapped,
    wrapIv: iv,
    privateKey: kp.privateKey,
    fields: { name, email, salt, authSecret, publicKey, wrappedPrivateKey: wrapped, wrapIv: iv },
  };
}

export async function secretFor(pin: string, salt: string): Promise<string> {
  return (await deriveSecrets(pin, salt, IT)).authSecret;
}
