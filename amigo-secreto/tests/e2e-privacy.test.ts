import "@/tests/db-guard";
import { describe, test, expect, beforeAll } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { IT, makeAccount, mkReq, sessionCookie, type Account } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { buildDraw } from "@/lib/draw";
import { deriveSecrets } from "@/lib/crypto/kdf";
import { unwrapPrivateKey } from "@/lib/crypto/keys";
import { openPayload } from "@/lib/crypto/hybrid";
import { POST as createGroup } from "@/app/api/groups/route";
import { POST as join } from "@/app/api/join/route";
import { GET as getSalt } from "@/app/api/salt/route";
import { POST as login } from "@/app/api/login/route";
import { GET as me } from "@/app/api/me/route";
import { PUT as putWishes } from "@/app/api/wishes/route";
import { GET as drawInputs } from "@/app/api/draw/inputs/route";
import { POST as postDraw } from "@/app/api/draw/route";
import { GET as getResult } from "@/app/api/result/route";

// Distinctive values so a leak is easy to grep for in what the server stores.
const NAMES = ["Zulema", "Bartolomé", "Ximena", "Evaristo", "Nicanora"];
const PINS = ["pin-Zulema-77", "pin-Bartolome-77", "pin-Ximena-77", "pin-Evaristo-77", "pin-Nicanora-77"];

type Person = { acct: Account; name: string; pin: string; cookie: string };
const people: Person[] = [];

/** What a browser does to sign in: fetch the salt, derive the auth secret, log in, then unlock the private key. */
async function signInAndUnlock(p: Person) {
  const { salt } = await (await getSalt(mkReq("GET", `/api/salt?email=${encodeURIComponent(p.acct.email)}`))).json();
  const { authSecret, wrapKey } = await deriveSecrets(p.pin, salt, IT);
  const res = await login(mkReq("POST", "/api/login", { email: p.acct.email, authSecret }));
  expect(res.status).toBe(200);
  const cookie = sessionCookie(res);
  const mine = await (await me(mkReq("GET", "/api/me", undefined, cookie))).json();
  const privateKey = await unwrapPrivateKey(mine.wrappedPrivateKey, mine.wrapIv, wrapKey);
  return { cookie, privateKey };
}

beforeAll(async () => {
  await resetDb();
  const first = await makeAccount(NAMES[0], "zulema@example.com", PINS[0]);
  const created = await createGroup(
    mkReq("POST", "/api/groups", { groupName: "Fam", priceCap: 60000, expectedSize: NAMES.length, ...first.fields }),
  );
  const { inviteCode } = await created.json();
  people.push({ acct: first, name: NAMES[0], pin: PINS[0], cookie: sessionCookie(created) });
  for (let i = 1; i < NAMES.length; i++) {
    const a = await makeAccount(NAMES[i], `${NAMES[i].toLowerCase()}@example.com`, PINS[i]);
    const r = await join(mkReq("POST", "/api/join", { inviteCode, ...a.fields }));
    people.push({ acct: a, name: NAMES[i], pin: PINS[i], cookie: sessionCookie(r) });
  }
  for (const p of people) {
    const wishes = [1, 2, 3].map((n) => ({ title: `Regalo ${n} de ${p.name}`, price: `$${n}0.000` }));
    const r = await putWishes(mkReq("PUT", "/api/wishes", { wishes }, p.cookie));
    expect(r.status).toBe(200);
  }
  const org = people[0];
  const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, org.cookie))).json();
  const results = await buildDraw(inputs);
  expect((await postDraw(mkReq("POST", "/api/draw", { results }, org.cookie))).status).toBe(200);
});

describe("end-to-end privacy", () => {
  test("every person signs in with their PIN, opens their own result, and the pairings form a derangement", async () => {
    const givesTo = new Map<string, string>();
    for (const p of people) {
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
    const p = people[1];
    const { salt } = await (await getSalt(mkReq("GET", `/api/salt?email=${encodeURIComponent(p.acct.email)}`))).json();
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
    const a = people[1];
    const b = people[2];
    const { cookie } = await signInAndUnlock(a);
    const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, cookie))).json();
    await expect(openPayload(sealed, b.acct.privateKey)).rejects.toBeDefined();
  });
});
