import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, sessionCookie, makeCreds, secretFor, createFamily, claim, claimAll, fakeNames, type Person } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { POST as createGroup } from "./groups/route";
import { GET as groupInfo } from "./groups/[code]/route";
import { GET as roster } from "./roster/route";
import { POST as join } from "./join/route";
import { GET as getSalt } from "./salt/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";
import { POST as addMember } from "./members/route";

const info = (code: string) => groupInfo(mkReq("GET", `/api/groups/${code}`), { params: Promise.resolve({ code }) });
const saltOf = async (id: string) => (await getSalt(mkReq("GET", `/api/salt?memberId=${id}`))).json();
const signIn = async (p: Person, pin = p.pin) =>
  login(mkReq("POST", "/api/login", { memberId: p.id, authSecret: await secretFor(pin, p.creds!.salt) }));

async function createBody(over: Record<string, unknown> = {}) {
  const { privateKey, ...fields } = await makeCreds("1234");
  void privateKey;
  return { groupName: "Fam", eventDate: "2026-12-24", priceCap: 60000, names: fakeNames(3), me: "Persona A", ...fields, ...over };
}

beforeEach(async () => {
  await resetDb();
});

describe("creating the group", () => {
  test("creates the roster, claims the organizer and /api/me shows them without any email", async () => {
    const fam = await createFamily({ size: 3 });
    expect(fam.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    const r = await me(mkReq("GET", "/api/me", undefined, fam.org.cookie));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.user).toEqual({ id: fam.org.id, name: "Persona A", isOrganizer: true });
    expect(body.group).toMatchObject({ name: "Fam", priceCap: 60000, drawDone: false, inviteCode: fam.inviteCode });
    expect(body.group).not.toHaveProperty("expectedSize");
    expect(typeof body.wrappedPrivateKey).toBe("string");
    expect(body.wishes).toEqual([]);
  });

  test("the organizer's row has credentials from the start; everyone else is unclaimed", async () => {
    await createFamily({ size: 3 });
    const rows = await sql`SELECT name, auth_hash IS NOT NULL AS claimed, public_key IS NOT NULL AS has_key FROM users ORDER BY name`;
    expect(rows.map((r) => [r.name, r.claimed, r.has_key])).toEqual([
      ["Persona A", true, true],
      ["Persona B", false, false],
      ["Persona C", false, false],
    ]);
    const g = await sql`SELECT organizer_id FROM groups`;
    const orgRow = await sql`SELECT id FROM users WHERE name = 'Persona A'`;
    expect(g[0].organizer_id).toBe(orgRow[0].id);
  });

  test("only one group can exist: a second create is refused and the first is untouched", async () => {
    const fam = await createFamily({ size: 3 });
    const second = await createGroup(mkReq("POST", "/api/groups", await createBody({ groupName: "Intruso" })));
    expect(second.status).toBe(409);
    expect((await sql`SELECT count(*)::int AS n FROM groups`)[0].n).toBe(1);
    expect((await info(fam.inviteCode)).status).toBe(200);
  });

  test.each([
    ["fewer than two names", { names: ["Persona A"], me: "Persona A" }],
    ["more than fifty names", { names: Array.from({ length: 51 }, (_, i) => `P${i}`), me: "P0" }],
    ["a duplicate name, ignoring case and spacing", { names: ["Persona A", "persona  a", "Persona B"], me: "Persona A" }],
    ["an organizer who is not on the list", { me: "Alguien Más" }],
    ["a name over 60 characters", { names: ["Persona A", "x".repeat(61)], me: "Persona A" }],
    ["a malformed public key", { publicKey: '{"kty":"RSA"}' }],
    ["a missing price cap", { priceCap: 0 }],
  ])("rejects %s", async (_label, over) => {
    const r = await createGroup(mkReq("POST", "/api/groups", await createBody(over)));
    expect(r.status).toBe(422);
    expect((await sql`SELECT count(*)::int AS n FROM groups`)[0].n).toBe(0);
  });
});

describe("join page and sign-in list", () => {
  test("GET /api/groups/[code] shows every name with its claimed flag, in Spanish order", async () => {
    const names = ["Zulema Gil", "Ñandú Pérez", "Nicolás Ruiz", "Ángela Soto"];
    const fam = await createFamily({ names, organizer: "Zulema Gil" });
    const body = await (await info(fam.inviteCode)).json();
    expect(body).toMatchObject({ name: "Fam", eventDate: "2026-12-24", priceCap: 60000 });
    expect(body.members.map((m: { name: string }) => m.name)).toEqual(["Ángela Soto", "Nicolás Ruiz", "Ñandú Pérez", "Zulema Gil"]);
    expect(body.members.map((m: { claimed: boolean }) => m.claimed)).toEqual([false, false, false, true]);
    expect((await info("NOPE")).status).toBe(404);
  });

  test("/api/roster is empty before a group exists", async () => {
    const r = await roster(mkReq("GET", "/api/roster"));
    expect(await r.json()).toEqual({ group: null, members: [] });
  });

  test("/api/roster lists only claimed names, alphabetically, and nothing secret", async () => {
    const names = ["Zulema Gil", "Ñandú Pérez", "Nicolás Ruiz", "Ángela Soto"];
    const fam = await createFamily({ names, organizer: "Zulema Gil" });
    let body = await (await roster(mkReq("GET", "/api/roster"))).json();
    expect(body.members.map((m: { name: string }) => m.name)).toEqual(["Zulema Gil"]);

    await claim(fam, fam.people.find((p) => p.name === "Ángela Soto")!);
    await claim(fam, fam.people.find((p) => p.name === "Ñandú Pérez")!);
    body = await (await roster(mkReq("GET", "/api/roster"))).json();
    expect(body.group).toMatchObject({ name: "Fam", priceCap: 60000 });
    expect(body.members.map((m: { name: string }) => m.name)).toEqual(["Ángela Soto", "Ñandú Pérez", "Zulema Gil"]);
    expect(JSON.stringify(body)).not.toMatch(/salt|hash|public|wrapped|invite/i);
  });
});

describe("claiming a name", () => {
  test("a person picks their name, gets a session, and is not the organizer", async () => {
    const fam = await createFamily({ size: 3 });
    const b = fam.people.find((p) => p.name === "Persona B")!;
    const r = await claim(fam, b);
    expect(r.status).toBe(201);
    const body = await (await me(mkReq("GET", "/api/me", undefined, b.cookie))).json();
    expect(body.user).toEqual({ id: b.id, name: "Persona B", isOrganizer: false });
  });

  test("an already claimed name cannot be claimed again, and the first owner's PIN still works", async () => {
    const fam = await createFamily({ size: 3 });
    const b = fam.people.find((p) => p.name === "Persona B")!;
    expect((await claim(fam, b, "pin-de-b")).status).toBe(201);
    const thief: Person = { ...b, cookie: "", creds: null };
    expect((await claim(fam, thief, "pin-ladron")).status).toBe(409);
    expect((await signIn(b, "pin-de-b")).status).toBe(200);
    expect((await login(mkReq("POST", "/api/login", { memberId: b.id, authSecret: await secretFor("pin-ladron", b.creds!.salt) }))).status).toBe(401);
  });

  test("two people claiming the same name at once: exactly one wins", async () => {
    const fam = await createFamily({ size: 3 });
    const b = fam.people.find((p) => p.name === "Persona B")!;
    const [x, y] = [{ ...b, creds: null, cookie: "" }, { ...b, creds: null, cookie: "" }];
    const results = await Promise.all([claim(fam, x, "uno-uno"), claim(fam, y, "dos-dos")]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  test("unknown member, malformed id and wrong invite code are 404", async () => {
    const fam = await createFamily({ size: 3 });
    const c = await makeCreds("1234");
    const { privateKey, ...f } = c;
    void privateKey;
    const post = (body: Record<string, unknown>) => join(mkReq("POST", "/api/join", { inviteCode: fam.inviteCode, ...f, ...body }));
    expect((await post({ memberId: "00000000-0000-0000-0000-000000000000" })).status).toBe(404);
    expect((await post({ memberId: "not-a-uuid" })).status).toBe(404);
    expect((await post({ memberId: fam.people[1].id, inviteCode: "ZZZZZZZZ" })).status).toBe(404);
  });

  test("a malformed public key is rejected and the name stays free", async () => {
    const fam = await createFamily({ size: 3 });
    const b = fam.people[1];
    const { privateKey, ...f } = await makeCreds("1234");
    void privateKey;
    const r = await join(mkReq("POST", "/api/join", { inviteCode: fam.inviteCode, memberId: b.id, ...f, publicKey: "{}" }));
    expect(r.status).toBe(422);
    expect((await claim(fam, b)).status).toBe(201);
  });
});

describe("sign-in", () => {
  test("works with the member id and PIN only, with no prior cookie", async () => {
    const fam = await createFamily({ size: 3 });
    const salt = await saltOf(fam.org.id);
    expect(salt).toEqual({ salt: fam.org.creds!.salt, reset: false });
    const r = await signIn(fam.org);
    expect(r.status).toBe(200);
    expect(sessionCookie(r)).not.toBe("");
  });

  test("4 wrong PINs then the right one succeeds and resets the counter", async () => {
    const fam = await createFamily({ size: 3 });
    for (let i = 0; i < 4; i++) expect((await signIn(fam.org, "9999")).status).toBe(401);
    expect((await signIn(fam.org)).status).toBe(200);
    expect((await sql`SELECT failed_attempts FROM users WHERE id = ${fam.org.id}`)[0].failed_attempts).toBe(0);
  });

  test("5 wrong PINs lock the account, even for the correct PIN", async () => {
    const fam = await createFamily({ size: 3 });
    for (let i = 0; i < 5; i++) await signIn(fam.org, "9999");
    expect((await signIn(fam.org)).status).toBe(423);
    expect((await signIn(fam.org, "9999")).status).toBe(423);
  });

  test("the lockout is released once locked_until passes", async () => {
    const fam = await createFamily({ size: 3 });
    for (let i = 0; i < 5; i++) await signIn(fam.org, "9999");
    expect((await signIn(fam.org)).status).toBe(423);
    await sql`UPDATE users SET locked_until = now() - interval '1 minute' WHERE id = ${fam.org.id}`;
    expect((await signIn(fam.org)).status).toBe(200);
  });

  test("an unclaimed or unknown member gets 401 (never a 500) and a stable fake salt", async () => {
    const fam = await createFamily({ size: 3 });
    const unclaimed = fam.people.find((p) => p.name === "Persona B")!;
    for (const id of [unclaimed.id, "00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
      const a = await saltOf(id);
      const b = await saltOf(id);
      expect(a).toEqual(b);
      expect(a.reset).toBe(false);
      const r = await login(mkReq("POST", "/api/login", { memberId: id, authSecret: "x" }));
      expect(r.status).toBe(401);
    }
    expect((await saltOf(unclaimed.id)).salt).not.toBe((await saltOf("00000000-0000-0000-0000-000000000000")).salt);
  });
});

describe("sessions", () => {
  test("/api/me without a cookie is 401", async () => {
    expect((await me(mkReq("GET", "/api/me"))).status).toBe(401);
  });

  test("an expired session is 401", async () => {
    const fam = await createFamily({ size: 3 });
    await sql`UPDATE sessions SET expires_at = now() - interval '1 minute'`;
    expect((await me(mkReq("GET", "/api/me", undefined, fam.org.cookie))).status).toBe(401);
  });

  test("logout invalidates the session", async () => {
    const fam = await createFamily({ size: 3 });
    expect((await logout(mkReq("POST", "/api/logout", {}, fam.org.cookie))).status).toBe(200);
    expect((await me(mkReq("GET", "/api/me", undefined, fam.org.cookie))).status).toBe(401);
  });
});

describe("adding a person to the roster", () => {
  const add = (cookie: string, name: unknown) => addMember(mkReq("POST", "/api/members", { name }, cookie));

  test("the organizer adds an unclaimed name that then appears on the join page", async () => {
    const fam = await createFamily({ size: 3 });
    const r = await add(fam.org.cookie, "  Zoe   Nueva ");
    expect(r.status).toBe(201);
    const body = await (await info(fam.inviteCode)).json();
    expect(body.members.find((m: { name: string }) => m.name === "Zoe Nueva")).toMatchObject({ claimed: false });
  });

  test("a duplicate name (ignoring case) is a conflict, an empty or overlong name is 422", async () => {
    const fam = await createFamily({ size: 3 });
    expect((await add(fam.org.cookie, "persona  b")).status).toBe(409);
    expect((await add(fam.org.cookie, "   ")).status).toBe(422);
    expect((await add(fam.org.cookie, "x".repeat(61))).status).toBe(422);
    expect((await add(fam.org.cookie, 42)).status).toBe(422);
  });

  test("only the organizer can add, and only with a session", async () => {
    const fam = await createFamily({ size: 3 });
    const b = fam.people.find((p) => p.name === "Persona B")!;
    await claim(fam, b);
    expect((await add(b.cookie, "Zoe Nueva")).status).toBe(403);
    expect((await add("", "Zoe Nueva")).status).toBe(401);
  });

  test("everyone can claim once all names are taken, and a late name stays open", async () => {
    const fam = await createFamily({ size: 3 });
    await claimAll(fam);
    await add(fam.org.cookie, "Zoe Nueva");
    const body = await (await info(fam.inviteCode)).json();
    expect(body.members.filter((m: { claimed: boolean }) => !m.claimed)).toHaveLength(1);
  });
});
