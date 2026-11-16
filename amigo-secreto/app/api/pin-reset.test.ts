import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, sessionCookie, makeCreds, secretFor, createFamily, claimAll, readyFamily, saveWishes, type Person } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { buildDraw } from "@/lib/draw";
import { openPayload } from "@/lib/crypto/hybrid";
import { POST as login } from "./login/route";
import { GET as getSalt } from "./salt/route";
import { GET as me } from "./me/route";
import { GET as drawInputs } from "./draw/inputs/route";
import { POST as postDraw } from "./draw/route";
import { GET as getResult } from "./result/route";
import { GET as groupStatus } from "./group/route";
import { POST as startReset } from "./members/[id]/reset-pin/route";
import { POST as finishReset } from "./pin-reset/route";

const reset = (actor: Person, targetId: string) =>
  startReset(mkReq("POST", `/api/members/${targetId}/reset-pin`, {}, actor.cookie), { params: Promise.resolve({ id: targetId }) });

/** What the browser sends when the person picks a new PIN: fresh salt, secret and key pair. */
async function newCreds(memberId: string, pin: string) {
  const { privateKey, ...fields } = await makeCreds(pin);
  return { privateKey, fields, body: { memberId, ...fields } };
}

const signIn = async (p: Person, pin: string, salt = p.creds!.salt) =>
  login(mkReq("POST", "/api/login", { memberId: p.id, authSecret: await secretFor(pin, salt) }));

const saltOf = async (id: string) => (await getSalt(mkReq("GET", `/api/salt?memberId=${id}`))).json();
const status = async (p: Person) => (await groupStatus(mkReq("GET", "/api/group", undefined, p.cookie))).json();

beforeEach(async () => {
  await resetDb();
});

describe("organizer starts a PIN reset", () => {
  test("the member's sessions end, sign-in is refused, and the salt route reports the reset", async () => {
    const fam = await createFamily({ size: 3 });
    await claimAll(fam);
    const target = fam.people[1];
    expect((await reset(fam.org, target.id)).status).toBe(200);

    expect((await me(mkReq("GET", "/api/me", undefined, target.cookie))).status).toBe(401);
    const refused = await signIn(target, "1234");
    expect(refused.status).toBe(403);
    expect((await refused.json()).resetRequired).toBe(true);

    expect((await saltOf(target.id)).reset).toBe(true);
    expect((await saltOf(fam.people[2].id)).reset).toBe(false);
    expect((await saltOf("00000000-0000-0000-0000-000000000000")).reset).toBe(false);
  });

  test("only the organizer can start it, not for themselves, and not for an unknown or unclaimed member", async () => {
    const fam = await createFamily({ size: 3 });
    const [, b, c] = fam.people;
    await claimAll({ ...fam, people: [b] } as typeof fam);
    expect((await reset(b, c.id)).status).toBe(403);
    expect((await reset(fam.org, fam.org.id)).status).toBe(422);
    expect((await reset(fam.org, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await reset(fam.org, "not-a-uuid")).status).toBe(404);
    expect((await reset(fam.org, c.id)).status).toBe(409); // c has not joined, so there is no PIN to reset
  });
});

describe("the member chooses a new PIN", () => {
  test("they get back in with new keys, the old PIN stops working and wishes are kept", async () => {
    const fam = await createFamily({ size: 3 });
    await claimAll(fam);
    const target = fam.people[1];
    expect((await saveWishes(target)).status).toBe(200);
    await reset(fam.org, target.id);

    const fresh = await newCreds(target.id, "nuevo-pin-9");
    const done = await finishReset(mkReq("POST", "/api/pin-reset", fresh.body));
    expect(done.status).toBe(200);
    const mine = await (await me(mkReq("GET", "/api/me", undefined, sessionCookie(done)))).json();
    expect(mine.user.id).toBe(target.id);
    expect(mine.wishes).toHaveLength(3);
    expect(mine.wrappedPrivateKey).toBe(fresh.fields.wrappedPrivateKey);

    expect((await signIn(target, "nuevo-pin-9", fresh.fields.salt)).status).toBe(200);
    expect((await signIn(target, "1234", fresh.fields.salt)).status).toBe(401);
    expect((await saltOf(target.id)).reset).toBe(false);
  });

  test("it only works while a reset is open, and only once", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    const target = fam.people[1];
    const intruder = await newCreds(target.id, "intruso-77");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", intruder.body))).status).toBe(403);

    await reset(fam.org, target.id);
    const first = await newCreds(target.id, "primero-11");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", first.body))).status).toBe(200);
    const second = await newCreds(target.id, "segundo-22");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", second.body))).status).toBe(403);
  });

  test("an unknown or unclaimed member gets the same refusal as a closed reset", async () => {
    const fam = await createFamily({ size: 2 });
    for (const id of ["00000000-0000-0000-0000-000000000000", fam.people[1].id, "not-a-uuid"]) {
      const c = await newCreds(id, "whatever-1");
      expect((await finishReset(mkReq("POST", "/api/pin-reset", c.body))).status).toBe(403);
    }
  });

  test("an expired reset window is refused and the old PIN works again", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    const target = fam.people[1];
    await reset(fam.org, target.id);
    await sql`UPDATE users SET pin_reset_until = now() - interval '1 minute' WHERE id = ${target.id}`;
    const late = await newCreds(target.id, "tarde-33");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", late.body))).status).toBe(403);
    expect((await signIn(target, "1234")).status).toBe(200);
  });

  test("a malformed public key is rejected and the reset stays open", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    const target = fam.people[1];
    await reset(fam.org, target.id);
    const c = await newCreds(target.id, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", { ...c.body, publicKey: '{"kty":"RSA"}' }))).status).toBe(422);
    expect((await finishReset(mkReq("POST", "/api/pin-reset", c.body))).status).toBe(200);
  });

  test("failed-attempt counters and lockouts are cleared by the reset", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    const target = fam.people[1];
    for (let i = 0; i < 5; i++) await signIn(target, "9999");
    await reset(fam.org, target.id);
    const c = await newCreds(target.id, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", c.body))).status).toBe(200);
    expect((await signIn(target, "nuevo-pin-9", c.fields.salt)).status).toBe(200);
  });
});

describe("the draw is blocked while a reset is open", () => {
  test("canDraw is false, the member is flagged, and both draw endpoints refuse", async () => {
    const fam = await readyFamily(3);
    expect((await status(fam.org)).canDraw).toBe(true);
    await reset(fam.org, fam.people[1].id);

    const s = await status(fam.org);
    expect(s.canDraw).toBe(false);
    expect(s.members.find((m: { id: string }) => m.id === fam.people[1].id).resetPending).toBe(true);
    expect(s.members.filter((m: { resetPending: boolean }) => m.resetPending)).toHaveLength(1);
    expect((await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).status).toBe(409);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: [] }, fam.org.cookie))).status).toBe(409);
  });

  test("it unblocks once the person has chosen a new PIN", async () => {
    const fam = await readyFamily(3);
    await reset(fam.org, fam.people[1].id);
    const c = await newCreds(fam.people[1].id, "nuevo-pin-9");
    expect((await finishReset(mkReq("POST", "/api/pin-reset", c.body))).status).toBe(200);
    const s = await status(fam.org);
    expect(s.canDraw).toBe(true);
    expect(s.members.some((m: { resetPending: boolean }) => m.resetPending)).toBe(false);
  });

  test("it unblocks if the reset window lapses unused", async () => {
    const fam = await readyFamily(3);
    await reset(fam.org, fam.people[1].id);
    await sql`UPDATE users SET pin_reset_until = now() - interval '1 minute' WHERE id = ${fam.people[1].id}`;
    expect((await status(fam.org)).canDraw).toBe(true);
  });

  test("the draw really is sealed to the new key when it runs after the reset is used", async () => {
    const fam = await readyFamily(2);
    await reset(fam.org, fam.people[1].id);
    const c = await newCreds(fam.people[1].id, "nuevo-pin-9");
    const done = await finishReset(mkReq("POST", "/api/pin-reset", c.body));
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json();
    expect(inputs.find((i: { id: string }) => i.id === fam.people[1].id).publicKey).toBe(c.fields.publicKey);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: await buildDraw(inputs) }, fam.org.cookie))).status).toBe(200);
    const { sealed } = await (await getResult(mkReq("GET", "/api/result", undefined, sessionCookie(done)))).json();
    await expect(openPayload(sealed, c.privateKey)).resolves.toBeDefined();
  });
});

describe("a reset after the draw", () => {
  test("reopens the draw because the person's result cannot be recovered; wishes are kept", async () => {
    const fam = await readyFamily(2);
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json();
    expect((await postDraw(mkReq("POST", "/api/draw", { results: await buildDraw(inputs) }, fam.org.cookie))).status).toBe(200);
    expect((await getResult(mkReq("GET", "/api/result", undefined, fam.people[1].cookie))).status).toBe(200);

    expect((await reset(fam.org, fam.people[1].id)).status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await sql`SELECT draw_done FROM groups`)[0].draw_done).toBe(false);
    expect((await sql`SELECT count(*)::int AS n FROM wishes`)[0].n).toBe(6);
  });

  test("a reset before the draw leaves the draw state alone", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    await reset(fam.org, fam.people[1].id);
    expect((await sql`SELECT draw_done FROM groups`)[0].draw_done).toBe(false);
  });
});
