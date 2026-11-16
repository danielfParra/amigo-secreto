import { importPublicKey } from "@/lib/crypto/keys";
import { HttpError, email, text } from "./http";

export type AccountInput = {
  name: string;
  email: string;
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

export const NAME_MAX = 60;

/** Validates the fields a browser sends when creating an account (keys are generated client-side). */
export async function parseAccount(body: Record<string, unknown>): Promise<AccountInput> {
  const a: AccountInput = {
    name: text(body, "name", { max: NAME_MAX, label: "tu nombre" }),
    email: email(body),
    salt: text(body, "salt", { max: 64, label: "la sal" }),
    authSecret: text(body, "authSecret", { max: 128, label: "la clave de acceso" }),
    publicKey: text(body, "publicKey", { max: 2000, label: "la clave pública" }),
    wrappedPrivateKey: text(body, "wrappedPrivateKey", { max: 4000, label: "la clave privada" }),
    wrapIv: text(body, "wrapIv", { max: 64, label: "el vector de cifrado" }),
  };
  try {
    await importPublicKey(a.publicKey);
  } catch {
    throw new HttpError(422, "La clave pública no es válida", { field: "publicKey" });
  }
  return a;
}
