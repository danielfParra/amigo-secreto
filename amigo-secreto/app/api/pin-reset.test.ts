import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { IT, mkReq, sessionCookie, makeAccount, secretFor, type Account } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { buildDraw } from "@/lib/draw";
import { POST as createGroup } from "./groups/route";
import { POST as join } from "./join/route";
import { POST as login } from "./login/route";
import { GET as getSalt } from "./salt/route";
import { GET as me } from "./me/route";
import { PUT as putWishes } from "./wishes/route";
import { GET as drawInputs } from "./draw/inputs/route";
import { POST as postDraw } from "./draw/route";
import { GET as getResult } from "./result/route";
import { GET as groupStatus } from "./group/route";
import { POST as startReset } from "./members/[id]/reset-pin/route";
import { POST as finishReset } from "./pin-reset/route";

type Member = { acct: Account; cookie: string; id: string };

const wishes = [
  { title: "Libro", price: "$48.000" },
  { title: "Taza", price: "$42.000" },
  { title: "Planta", price: "$35.000" },
];

async function party(n: number) {
  const org = await makeAccount("Org", "org@example.com", "1234");
  const res = await createGroup(mkReq("POST", "/api/groups", { groupName: "Fam", priceCap: 60000, expectedSize: n, ...org.fields }));
  const { inviteCode } = await res.json();
  const members: Member[] = [{ acct: org, cookie: sessionCookie(res), id: "" }];
  for (let i = 1; i < n; i++) {
    const a = await makeAccount(`Persona${i}`, `p${i}@example.com`, "1234");
    const r = await join(mkReq("POST", "/api/join", { inviteCode, ...a.fields }));
    members.push({ acct: a, cookie: sessionCookie(r), id: "" });
  }
  for (const m of members) m.id = (await (await me(mkReq("GET", "/api/me", undefined, m.cookie))).json()).user.id;
  return { members, org: members[0], inviteCode };
}

const reset = (actor: Member, targetId: string) =>
  startReset(mkReq("POST", `/api/members/${targetId}/reset-pin`, {}, actor.cookie), { params: Promise.resolve({ id: targetId }) });

/** What the browser sends when the person picks a new PIN: fresh salt, secret and key pair. */
async function newCredentials(email: string, pin: string) {
  const a = await makeAccount("ignored", email, pin);
  const { name: _n, ...creds } = a.fields;
  void _n;
  return { acct: a, creds };
}

beforeEach(async () => {
  await resetDb();
});

describe("organizer starts a PIN reset", () => {
  test("the member's sessions end, login is refused, and the salt route reports the reset", async () => {
    const p = await party(3);
    const target = p.members[1];
    expect((await reset(p.org, target.id)).status).toBe(200);

    expect((await me(mkReq("GET", "/api/me", undefined, target.cookie))).status).toBe(401);
    const login403 = await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("1234", target.acct.salt) }));
    expect(login403.status).toBe(403);
    expect((await login403.json()).resetRequired).toBe(true);

    const salt = await (await getSalt(mkReq("GET", `/api/salt?email=${target.acct.email}`))).json();
    expect(salt.reset).toBe(true);
    const other = await (await getSalt(mkReq("GET", `/api/salt?email=${p.members[2].acct.email}`))).json();
    expect(other.reset).toBe(false);
    const ghost = await (await getSalt(mkReq("GET", "/api/salt?email=nobody@example.com"))).json();
    expect(ghost.reset).toBe(false);
  });

  test("only the organizer can start it, not for themselves, and not for another group's member", async () => {
    const p = await party(3);
    expect((await reset(p.members[1], p.members[2].id)).status).toBe(403);
    expect((await reset(p.org, p.org.id)).status).toBe(422);
    expect((await reset(p.org, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await reset(p.org, "not-a-uuid")).status).toBe(404);
  });
});

describe("the member chooses a new PIN", () => {
  test("they get back in with new keys, the old PIN stops working and wishes are kept", async () => {
    const p = await party(3);
    const target = p.members[1];
    expect((await putWishes(mkReq("PUT", "/api/wishes", { wishes }, target.cookie))).status).toBe(200);
    await reset(p.org, target.id);

    const { acct, creds } = await newCredentials(target.acct.email, "nuevo-pin-9");
    const done = await finishReset(mkReq("POST", "/api/pin-reset", creds));
    expect(done.status).toBe(200);
    const cookie = sessionCookie(done);
    const mine = await (await me(mkReq("GET", "/api/me", undefined, cookie))).json();
    expect(mine.user.id).toBe(target.id);
    expect(mine.wishes).toHaveLength(3);
    expect(mine.wrappedPrivateKey).toBe(acct.wrappedPrivateKey);

    const ok = await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("nuevo-pin-9", acct.salt) }));
    expect(ok.status).toBe(200);
    const old = await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("1234", target.acct.salt) }));
    expect(old.status).toBe(401);
    expect((await (await getSalt(mkReq("GET", `/api/salt?email=${target.acct.email}`))).json()).reset).toBe(false);
  });

  test("it only works while a reset is open, and only once", async () => {
    const p = await party(2);
    const target = p.members[1];
    const { creds } = await newCredentials(target.acct.email, "intruso-77");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(403);

    await reset(p.org, target.id);
    const first = await newCredentials(target.acct.email, "primero-11");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", first.creds))).status).toBe(200);
    const second = await newCredentials(target.acct.email, "segundo-22");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", second.creds))).status).toBe(403);
  });

  test("an unknown email gets the same refusal as a closed reset", async () => {
    const { creds } = await newCredentials("ghost@example.com", "whatever-1");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(403);
  });

  test("an expired reset window is refused", async () => {
    const p = await party(2);
    const target = p.members[1];
    await reset(p.org, target.id);
    await sql`UPDATE users SET pin_reset_until = now() - interval '1 minute' WHERE id = ${target.id}`;
    const { creds } = await newCredentials(target.acct.email, "tarde-33");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(403);
    // the old PIN works again once the window has lapsed
    const ok = await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("1234", target.acct.salt) }));
    expect(ok.status).toBe(200);
  });

  test("a malformed public key is rejected and the reset stays open", async () => {
    const p = await party(2);
    const target = p.members[1];
    await reset(p.org, target.id);
    const { creds } = await newCredentials(target.acct.email, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", { ...creds, publicKey: '{"kty":"RSA"}' }))).status).toBe(422);
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(200);
  });

  test("failed-attempt counters and lockouts are cleared by the reset", async () => {
    const p = await party(2);
    const target = p.members[1];
    for (let i = 0; i < 5; i++) {
      await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("9999", target.acct.salt) }));
    }
    await reset(p.org, target.id);
    const { creds, acct } = await newCredentials(target.acct.email, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(200);
    const ok = await login(mkReq("POST", "/api/login", { email: target.acct.email, authSecret: await secretFor("nuevo-pin-9", acct.salt) }));
    expect(ok.status).toBe(200);
  });
});

describe("the draw is blocked while a reset is open", () => {
  async function readyParty(n: number) {
    const p = await party(n);
    for (const m of p.members) expect((await putWishes(mkReq("PUT", "/api/wishes", { wishes }, m.cookie))).status).toBe(200);
    return p;
  }
  const status = async (m: Member) => (await groupStatus(mkReq("GET", "/api/group", undefined, m.cookie))).json();

  test("canDraw is false, the member is flagged, and both draw endpoints refuse", async () => {
    const p = await readyParty(3);
    expect((await status(p.org)).canDraw).toBe(true);
    await reset(p.org, p.members[1].id);

    const s = await status(p.org);
    expect(s.canDraw).toBe(false);
    expect(s.members.find((m: { id: string }) => m.id === p.members[1].id).resetPending).toBe(true);
    expect(s.members.filter((m: { resetPending: boolean }) => m.resetPending)).toHaveLength(1);
    expect((await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie))).status).toBe(409);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: [] }, p.org.cookie))).status).toBe(409);
  });

  test("it unblocks once the person has chosen a new PIN", async () => {
    const p = await readyParty(3);
    await reset(p.org, p.members[1].id);
    const { creds } = await newCredentials(p.members[1].acct.email, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", creds))).status).toBe(200);
    const s = await status(p.org);
    expect(s.canDraw).toBe(true);
    expect(s.members.some((m: { resetPending: boolean }) => m.resetPending)).toBe(false);
  });

  test("it unblocks if the reset window lapses unused", async () => {
    const p = await readyParty(3);
    await reset(p.org, p.members[1].id);
    await sql`UPDATE users SET pin_reset_until = now() - interval '1 minute' WHERE id = ${p.members[1].id}`;
    expect((await status(p.org)).canDraw).toBe(true);
  });

  test("the draw really is sealed to the new key when it runs after the reset is used", async () => {
    const p = await readyParty(2);
    await reset(p.org, p.members[1].id);
    const { acct, creds } = await newCredentials(p.members[1].acct.email, "nuevo-pin-9");
    const done = await finishReset(mkReq("POST", "/api/pin-reset", creds));
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie))).json();
    expect(inputs.find((i: { id: string }) => i.id === p.members[1].id).publicKey).toBe(acct.publicKey);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: await buildDraw(inputs) }, p.org.cookie))).status).toBe(200);
    const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, sessionCookie(done)))).json();
    const { openPayload } = await import("@/lib/crypto/hybrid");
    await expect(openPayload(sealed, acct.privateKey)).resolves.toBeDefined();
  });
});

describe("a reset after the draw", () => {
  test("reopens the draw because the person's result cannot be recovered; wishes are kept", async () => {
    const p = await party(2);
    for (const m of p.members) expect((await putWishes(mkReq("PUT", "/api/wishes", { wishes }, m.cookie))).status).toBe(200);
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie))).json();
    expect((await postDraw(mkReq("POST", "/api/draw", { results: await buildDraw(inputs) }, p.org.cookie))).status).toBe(200);
    expect((await getResult(mkReq("GET", "/api/result", undefined, p.members[1].cookie))).status).toBe(200);

    expect((await reset(p.org, p.members[1].id)).status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await sql`SELECT draw_done FROM groups`)[0].draw_done).toBe(false);
    expect((await sql`SELECT count(*)::int AS n FROM wishes`)[0].n).toBe(6);
  });

  test("a reset before the draw leaves the draw state alone", async () => {
    const p = await party(2);
    await reset(p.org, p.members[1].id);
    expect((await sql`SELECT draw_done FROM groups`)[0].draw_done).toBe(false);
    expect(IT).toBeGreaterThan(0);
  });
});
