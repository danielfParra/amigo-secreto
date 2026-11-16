import { NextRequest } from "next/server";
import { newSalt, deriveSecrets } from "@/lib/crypto/kdf";
import { generateKeyPair, exportPublicKey, wrapPrivateKey } from "@/lib/crypto/keys";
import { POST as createGroup } from "@/app/api/groups/route";
import { GET as groupInfo } from "@/app/api/groups/[code]/route";
import { POST as join } from "@/app/api/join/route";
import { PUT as putWishes } from "@/app/api/wishes/route";

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
  const m = (res.headers.get("set-cookie") ?? "").match(/session=([^;]*)/);
  return m && m[1] ? `session=${m[1]}` : "";
}

export type Creds = {
  salt: string;
  authSecret: string;
  publicKey: string;
  wrappedPrivateKey: string;
  wrapIv: string;
};

/** What a browser sends when it picks a PIN: fresh salt, secret and key pair (the private key stays here). */
export async function makeCreds(pin: string): Promise<Creds & { privateKey: CryptoKey }> {
  const salt = newSalt();
  const { authSecret, wrapKey } = await deriveSecrets(pin, salt, IT);
  const kp = await generateKeyPair();
  const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, wrapKey);
  return { salt, authSecret, publicKey: await exportPublicKey(kp.publicKey), wrappedPrivateKey: wrapped, wrapIv: iv, privateKey: kp.privateKey };
}

export async function secretFor(pin: string, salt: string): Promise<string> {
  return (await deriveSecrets(pin, salt, IT)).authSecret;
}

export type Person = {
  name: string;
  id: string;
  pin: string;
  cookie: string;
  creds: (Creds & { privateKey: CryptoKey }) | null; // null until the name is claimed
};

export type Family = { inviteCode: string; org: Person; people: Person[] };

/** Fake family names: "Persona A", "Persona B", ... */
export const fakeNames = (n: number) => Array.from({ length: n }, (_, i) => `Persona ${String.fromCharCode(65 + i)}`);

/** Creates the one group through the API: the organizer is claimed, everyone else is an unclaimed roster row. */
export async function createFamily(
  opts: { names?: string[]; organizer?: string; pin?: string; priceCap?: number; size?: number } = {},
): Promise<Family> {
  const names = opts.names ?? fakeNames(opts.size ?? 3);
  const organizer = opts.organizer ?? names[0];
  const pin = opts.pin ?? "1234";
  const creds = await makeCreds(pin);
  const { privateKey, ...fields } = creds;
  void privateKey;
  const res = await createGroup(
    mkReq("POST", "/api/groups", { groupName: "Fam", eventDate: "2026-12-24", priceCap: opts.priceCap ?? 60000, names, me: organizer, ...fields }),
  );
  if (res.status !== 201) throw new Error(`createFamily failed: ${res.status} ${await res.text()}`);
  const { inviteCode } = await res.json();
  const info = await (await groupInfo(mkReq("GET", `/api/groups/${inviteCode}`), { params: Promise.resolve({ code: inviteCode }) })).json();
  const people: Person[] = info.members.map((m: { id: string; name: string }) => ({
    name: m.name,
    id: m.id,
    pin,
    cookie: m.name === organizer ? sessionCookie(res) : "",
    creds: m.name === organizer ? creds : null,
  }));
  return { inviteCode, org: people.find((p) => p.name === organizer)!, people };
}

/** The person picks their name on the invite page and chooses a PIN. */
export async function claim(fam: Pick<Family, "inviteCode">, p: Person, pin = p.pin): Promise<Response> {
  const creds = await makeCreds(pin);
  const { privateKey, ...fields } = creds;
  void privateKey;
  const res = await join(mkReq("POST", "/api/join", { inviteCode: fam.inviteCode, memberId: p.id, ...fields }));
  if (res.status === 201) {
    p.cookie = sessionCookie(res);
    p.creds = creds;
    p.pin = pin;
  }
  return res;
}

export async function claimAll(fam: Family): Promise<void> {
  for (const p of fam.people) if (!p.creds) expect201(await claim(fam, p), p.name);
}

function expect201(res: Response, who: string) {
  if (res.status !== 201) throw new Error(`claim failed for ${who}: ${res.status}`);
}

export const okWishes = [
  { title: "Libro de recetas", price: "$48.000", link: "tienda.com/libro" },
  { title: "Taza térmica", price: "42.000" },
  { title: "Planta", price: "35000" },
];

export const saveWishes = (p: Person, wishes: unknown = okWishes) =>
  putWishes(mkReq("PUT", "/api/wishes", { wishes }, p.cookie));

/** A fully ready family: everyone claimed their name and saved three wishes. */
export async function readyFamily(size = 3): Promise<Family> {
  const fam = await createFamily({ size });
  await claimAll(fam);
  for (const p of fam.people) {
    const r = await saveWishes(p);
    if (r.status !== 200) throw new Error(`saveWishes failed for ${p.name}: ${r.status}`);
  }
  return fam;
}
