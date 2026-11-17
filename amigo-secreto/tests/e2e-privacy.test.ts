import "@/tests/db-guard";
import { describe, test, expect, beforeAll } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { IT, mkReq, sessionCookie, createFamily, drawBody, claim, saveWishes, type Family, type Person } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { deriveSecrets } from "@/lib/crypto/kdf";
import { unwrapPrivateKey } from "@/lib/crypto/keys";
import { openPayload } from "@/lib/crypto/hybrid";
import { GET as getSalt } from "@/app/api/salt/route";
import { POST as login } from "@/app/api/login/route";
import { GET as me } from "@/app/api/me/route";
import { GET as drawInputs } from "@/app/api/draw/inputs/route";
import { POST as postDraw } from "@/app/api/draw/route";
import { GET as getResult } from "@/app/api/result/route";
import { GET as getInbox } from "@/app/api/inbox/route";
import { POST as chatSend } from "@/app/api/chat/send/route";
import { sealMessage, type Thread } from "@/lib/crypto/chat";

// Distinctive fake names and PINs so a leak is easy to grep for in what the server stores.
const NAMES = ["Zulema Gil", "Bartolomé Ruiz", "Ximena Soto", "Evaristo Mora", "Nicanora Vega"];
const PINS = ["pin-Zulema-77", "pin-Bartolome-77", "pin-Ximena-77", "pin-Evaristo-77", "pin-Nicanora-77"];

let fam: Family;
const pinOf = (p: Person) => PINS[NAMES.indexOf(p.name)];

/** What a browser does to sign in: fetch the salt, derive the auth secret, log in, then unlock the private key. */
async function signInAndUnlock(p: Person) {
  const { salt } = await (await getSalt(mkReq("GET", `/api/salt?memberId=${p.id}`))).json();
  const { authSecret, wrapKey } = await deriveSecrets(pinOf(p), salt, IT);
  const res = await login(mkReq("POST", "/api/login", { memberId: p.id, authSecret }));
  expect(res.status).toBe(200);
  const cookie = sessionCookie(res);
  const mine = await (await me(mkReq("GET", "/api/me", undefined, cookie))).json();
  const privateKey = await unwrapPrivateKey(mine.wrappedPrivateKey, mine.wrapIv, wrapKey);
  return { cookie, privateKey };
}

beforeAll(async () => {
  await resetDb();
  fam = await createFamily({ names: NAMES, organizer: NAMES[0], pin: PINS[0] });
  // Everyone else claims their name with their own PIN.
  for (const p of fam.people) p.pin = pinOf(p);
  for (const p of fam.people) if (!p.creds) expect((await claim(fam, p, pinOf(p))).status).toBe(201);
  for (const p of fam.people) {
    const wishes = [1, 2, 3].map((n) => ({ title: `Regalo ${n} de ${p.name}`, price: `$${n}0.000` }));
    expect((await saveWishes(p, wishes)).status).toBe(200);
  }
  const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json();
  expect((await postDraw(mkReq("POST", "/api/draw", await drawBody(inputs), fam.org.cookie))).status).toBe(200);
});

describe("end-to-end privacy", () => {
  test("every person signs in with their PIN, opens their own result, and the pairings form a derangement", async () => {
    const givesTo = new Map<string, string>();
    for (const p of fam.people) {
      const { cookie, privateKey } = await signInAndUnlock(p);
      const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, cookie))).json();
      const payload = await openPayload<{ receiverName: string; wishes: { title: string }[] }>(sealed, privateKey);
      expect(payload.receiverName).not.toBe(p.name);
      expect(payload.wishes.map((w) => w.title)).toEqual([1, 2, 3].map((n) => `Regalo ${n} de ${payload.receiverName}`));
      givesTo.set(p.name, payload.receiverName);
    }
    expect([...givesTo.values()].sort()).toEqual([...NAMES].sort()); // everyone receives exactly once
  });

  test("a wrong PIN cannot unlock the private key", async () => {
    const p = fam.people[1];
    const { salt } = await (await getSalt(mkReq("GET", `/api/salt?memberId=${p.id}`))).json();
    const wrong = await deriveSecrets("totally-wrong", salt, IT);
    const mine = await (await me(mkReq("GET", "/api/me", undefined, p.cookie))).json();
    await expect(unwrapPrivateKey(mine.wrappedPrivateKey, mine.wrapIv, wrong.wrapKey)).rejects.toBeDefined();
  });

  test("all stored ciphertexts have the same length", async () => {
    const rows = await sql`SELECT length(sealed) AS len FROM results`;
    expect(rows).toHaveLength(NAMES.length);
    expect(new Set(rows.map((r) => r.len)).size).toBe(1);
  });

  test("the results table holds no plaintext name, wish or key material", async () => {
    const dump = JSON.stringify(await sql`SELECT * FROM results`);
    for (const n of NAMES) expect(dump).not.toContain(n);
    expect(dump).not.toContain("Regalo");
  });

  test("the server never stores or sees a PIN, in any table", async () => {
    const dump = JSON.stringify([
      await sql`SELECT * FROM users`,
      await sql`SELECT * FROM groups`,
      await sql`SELECT * FROM wishes`,
      await sql`SELECT * FROM results`,
      await sql`SELECT * FROM sessions`,
    ]);
    for (const pin of PINS) expect(dump).not.toContain(pin);
    expect(dump).not.toMatch(/"-----BEGIN|"d":"/); // no raw private key material either
  });

  test("nobody can open someone else's result with their own key", async () => {
    const a = fam.people[1];
    const b = fam.people[2];
    const { cookie } = await signInAndUnlock(a);
    const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, cookie))).json();
    await expect(openPayload(sealed, b.creds!.privateKey)).rejects.toBeDefined();
  });

  test("the database holds no email anywhere", async () => {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    expect(cols.map((c) => c.column_name)).not.toContain("email");
  });

  test("the chat tables hold no name, wish, thread id or message text, and inbox records match result lengths", async () => {
    const giver = fam.people[1];
    const { cookie, privateKey } = await signInAndUnlock(giver);
    const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, cookie))).json();
    const { thread } = await openPayload<{ thread: Thread }>(sealed, privateKey);
    const text = "mensaje-muy-reconocible-123";
    expect((await chatSend(mkReq("POST", "/api/chat/send", { threadId: thread.id, sealed: await sealMessage(thread.key, "g", text) }))).status).toBe(201);
    const inbox = await getInbox(mkReq("GET", "/api/inbox", undefined, cookie));
    expect(inbox.status).toBe(200);

    const dump = JSON.stringify([await sql`SELECT * FROM inbox`, await sql`SELECT * FROM chat_threads`, await sql`SELECT * FROM chat_messages`]);
    for (const n of NAMES) expect(dump).not.toContain(n);
    expect(dump).not.toContain("Regalo");
    expect(dump).not.toContain(text);
    expect(dump).not.toContain(thread.id);
    expect(dump).not.toContain(thread.key);

    const lens = await sql`SELECT length(sealed) AS len FROM results UNION ALL SELECT length(sealed) FROM inbox`;
    expect(lens).toHaveLength(NAMES.length * 2);
    expect(new Set(lens.map((r) => r.len)).size).toBe(1);
  });

  test("a chat message row has nothing that says who wrote it", async () => {
    const cols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages'`).map((c) => c.column_name);
    expect(cols.some((c) => /user|author|giver|receiver|sender/i.test(String(c)))).toBe(false);
  });
});
