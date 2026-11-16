import { importPublicKey } from "@/lib/crypto/keys";
import { NAME_MAX, nameKey } from "@/lib/names";
import { HttpError, text } from "./http";

export type Credentials = {
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

/** Validates the key material a browser sends when someone claims a name or replaces their PIN. */
export async function parseCredentials(body: Record<string, unknown>): Promise<Credentials> {
  const c: Credentials = {
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

/** A roster name: trimmed, single-spaced, 1..NAME_MAX characters. */
export function cleanName(raw: unknown, field = "name"): string {
  const name = typeof raw === "string" ? raw.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  if (!name) throw new HttpError(422, "Escribe un nombre", { field });
  if (name.length > NAME_MAX) throw new HttpError(422, `El nombre no puede pasar de ${NAME_MAX} letras`, { field });
  return name;
}

export { nameKey };
