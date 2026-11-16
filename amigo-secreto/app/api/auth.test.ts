import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, sessionCookie, makeAccount, secretFor, type Account } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { POST as createGroup, PATCH as patchGroup } from "./groups/route";
import { GET as groupInfo } from "./groups/[code]/route";
import { POST as join } from "./join/route";
import { GET as getSalt } from "./salt/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";

const groupBody = (a: Account, over: Record<string, unknown> = {}) => ({
  groupName: "Navidad en familia 2026",
  eventDate: "2026-12-24",
  priceCap: 60000,
  expectedSize: 3,
  ...a.fields,
  ...over,
});

async function setup() {
  const org = await makeAccount("Daniel", "daniel@example.com", "1234");
  const res = await createGroup(mkReq("POST", "/api/groups", groupBody(org)));
  const { inviteCode } = await res.json();
  return { org, inviteCode, orgCookie: sessionCookie(res), res };
}

async function joinAs(inviteCode: string, a: Account) {
  return join(mkReq("POST", "/api/join", { inviteCode, ...a.fields }));
}

async function loginAs(a: Account, pin = a.pin, cookie?: string) {
  const authSecret = await secretFor(pin, a.salt);
  return login(mkReq("POST", "/api/login", { email: a.email, authSecret }, cookie));
}

beforeEach(async () => {
  await resetDb();
});

describe("groups", () => {
  test("create group then /api/me shows the organizer and group", async () => {
    const { orgCookie, inviteCode, res } = await setup();
    expect(res.status).toBe(201);
    expect(inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    const r = await me(mkReq("GET", "/api/me", undefined, orgCookie));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.user).toMatchObject({ name: "Daniel", email: "daniel@example.com", isOrganizer: true });
    expect(body.group).toMatchObject({ name: "Navidad en familia 2026", priceCap: 60000, expectedSize: 3, drawDone: false, inviteCode });
    expect(typeof body.wrappedPrivateKey).toBe("string");
    expect(body.wishes).toEqual([]);
  });

  test("GET /api/groups/[code] returns only public info", async () => {
    const { inviteCode } = await setup();
    const r = await groupInfo(mkReq("GET", `/api/groups/${inviteCode}`), { params: Promise.resolve({ code: inviteCode }) });
    expect(await r.json()).toEqual({ name: "Navidad en familia 2026", eventDate: "2026-12-24", priceCap: 60000 });
    const missing = await groupInfo(mkReq("GET", "/api/groups/NOPE"), { params: Promise.resolve({ code: "NOPE" }) });
    expect(missing.status).toBe(404);
  });

  test("create group rejects a malformed public key", async () => {
    const org = await makeAccount("Daniel", "daniel@example.com");
    const r = await createGroup(mkReq("POST", "/api/groups", groupBody(org, { publicKey: '{"kty":"RSA"}' })));
    expect(r.status).toBe(422);
  });

  test("PATCH /api/groups raises expected size, rejects below member count and non-organizers", async () => {
    const { org, inviteCode, orgCookie } = await setup();
    const bob = await makeAccount("Bob", "bob@example.com");
    const bobRes = await joinAs(inviteCode, bob);
    const bobCookie = sessionCookie(bobRes);
    expect(org).toBeDefined();

    const up = await patchGroup(mkReq("PATCH", "/api/groups", { expectedSize: 5 }, orgCookie));
    expect(up.status).toBe(200);
    const below = await patchGroup(mkReq("PATCH", "/api/groups", { expectedSize: 1 }, orgCookie));
    expect(below.status).toBe(422);
    const members2 = await patchGroup(mkReq("PATCH", "/api/groups", { expectedSize: 2 }, orgCookie));
    expect(members2.status).toBe(200); // exactly the current member count is allowed
    const notOrg = await patchGroup(mkReq("PATCH", "/api/groups", { expectedSize: 4 }, bobCookie));
    expect(notOrg.status).toBe(403);
  });
});

describe("join", () => {
  test("a member can join with a valid invite code", async () => {
    const { inviteCode } = await setup();
    const ana = await makeAccount("Ana", "ana@example.com");
    const r = await joinAs(inviteCode, ana);
    expect(r.status).toBe(201);
    const body = await (await me(mkReq("GET", "/api/me", undefined, sessionCookie(r)))).json();
    expect(body.user.isOrganizer).toBe(false);
  });

  test("duplicate email is rejected, case-insensitively", async () => {
    const { inviteCode } = await setup();
    const a = await makeAccount("Ana", "ana@example.com");
    expect((await joinAs(inviteCode, a)).status).toBe(201);
    const dup = await makeAccount("Otra Ana", "ANA@Example.com");
    expect((await joinAs(inviteCode, dup)).status).toBe(409);
    const count = await sql`SELECT count(*)::int AS n FROM users WHERE lower(email) = 'ana@example.com'`;
    expect(count[0].n).toBe(1);
  });

  test("joining a full group is rejected", async () => {
    const { inviteCode } = await setup(); // expectedSize 3: organizer + 2
    expect((await joinAs(inviteCode, await makeAccount("A", "a@example.com"))).status).toBe(201);
    expect((await joinAs(inviteCode, await makeAccount("B", "b@example.com"))).status).toBe(201);
    expect((await joinAs(inviteCode, await makeAccount("C", "c@example.com"))).status).toBe(409);
  });

  test("an unknown invite code is rejected", async () => {
    const a = await makeAccount("A", "a@example.com");
    expect((await joinAs("ZZZZZZZZ", a)).status).toBe(404);
  });
});

describe("login", () => {
  test("login works with email and PIN only, no prior cookie and no invite code", async () => {
    const { org } = await setup();
    const salt = await (await getSalt(mkReq("GET", `/api/salt?email=${encodeURIComponent(org.email)}`))).json();
    expect(salt.salt).toBe(org.salt);
    const r = await loginAs(org);
    expect(r.status).toBe(200);
    expect(sessionCookie(r)).not.toBe("");
  });

  test("4 wrong PINs then the right one succeeds and resets the counter", async () => {
    const { org } = await setup();
    for (let i = 0; i < 4; i++) expect((await loginAs(org, "9999")).status).toBe(401);
    expect((await loginAs(org)).status).toBe(200);
    const row = await sql`SELECT failed_attempts FROM users WHERE email = ${org.email}`;
    expect(row[0].failed_attempts).toBe(0);
  });

  test("5 wrong PINs lock the account, even for the correct PIN", async () => {
    const { org } = await setup();
    for (let i = 0; i < 5; i++) await loginAs(org, "9999");
    expect((await loginAs(org)).status).toBe(423);
    expect((await loginAs(org, "9999")).status).toBe(423);
  });

  test("lockout is released once locked_until passes", async () => {
    const { org } = await setup();
    for (let i = 0; i < 5; i++) await loginAs(org, "9999");
    expect((await loginAs(org)).status).toBe(423);
    await sql`UPDATE users SET locked_until = now() - interval '1 minute' WHERE email = ${org.email}`;
    expect((await loginAs(org)).status).toBe(200);
  });

  test("unknown email gets 401 and a stable fake salt", async () => {
    const a = await (await getSalt(mkReq("GET", "/api/salt?email=ghost@example.com"))).json();
    const b = await (await getSalt(mkReq("GET", "/api/salt?email=ghost@example.com"))).json();
    expect(a.salt).toBe(b.salt);
    const r = await login(mkReq("POST", "/api/login", { email: "ghost@example.com", authSecret: "x" }));
    expect(r.status).toBe(401);
  });
});

describe("sessions", () => {
  test("/api/me without a cookie is 401", async () => {
    expect((await me(mkReq("GET", "/api/me"))).status).toBe(401);
  });

  test("an expired session is 401", async () => {
    const { orgCookie } = await setup();
    await sql`UPDATE sessions SET expires_at = now() - interval '1 minute'`;
    expect((await me(mkReq("GET", "/api/me", undefined, orgCookie))).status).toBe(401);
  });

  test("logout invalidates the session", async () => {
    const { orgCookie } = await setup();
    const out = await logout(mkReq("POST", "/api/logout", {}, orgCookie));
    expect(out.status).toBe(200);
    expect((await me(mkReq("GET", "/api/me", undefined, orgCookie))).status).toBe(401);
  });
});
