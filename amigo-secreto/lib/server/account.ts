import { importPublicKey } from "@/lib/crypto/keys";
import { HttpError, email, text } from "./http";

export type Credentials = {
  email: string;
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

export type AccountInput = Credentials & { name: string };

export const NAME_MAX = 60;

/** Validates the key material a browser sends when it creates or replaces its credentials. */
export async function parseCredentials(body: Record<string, unknown>): Promise<Credentials> {
  const c: Credentials = {
    email: email(body),
    salt: text(body, "salt", { max: 64, label: "la sal" }),
    authSecret: text(body, "authSecret", { max: 128, label: "la clave de acceso" }),
    publicKey: text(body, "publicKey", { max: 2000, label: "la clave pública" }),
    wrappedPrivateKey: text(body, "wrappedPrivateKey", { max: 4000, label: "la clave privada" }),
    wrapIv: text(body, "wrapIv", { max: 64, label: "el vector de cifrado" }),
  };
  try {
    await importPublicKey(c.publicKey);
  } catch {
    throw new HttpError(422, "La clave pública no es válida", { field: "publicKey" });
  }
  return c;
}

/** Credentials plus a display name: what a browser sends when creating an account. */
export async function parseAccount(body: Record<string, unknown>): Promise<AccountInput> {
  const name = text(body, "name", { max: NAME_MAX, label: "tu nombre" });
  return { name, ...(await parseCredentials(body)) };
}
