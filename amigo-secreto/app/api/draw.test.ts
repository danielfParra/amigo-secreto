import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, sessionCookie, makeAccount, type Account } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { buildDraw } from "@/lib/draw";
import { openPayload } from "@/lib/crypto/hybrid";
import { POST as createGroup } from "./groups/route";
import { POST as join } from "./join/route";
import { GET as me } from "./me/route";
import { PUT as putWishes } from "./wishes/route";
import { GET as groupStatus } from "./group/route";
import { GET as drawInputs } from "./draw/inputs/route";
import { POST as postDraw, DELETE as resetDraw } from "./draw/route";
import { GET as getResult } from "./result/route";
import { DELETE as removeMember } from "./members/[id]/route";

type Member = { acct: Account; cookie: string; id: string };

const okWishes = [
  { title: "Libro de recetas", price: "$48.000", link: "tienda.com/libro" },
  { title: "Taza térmica", price: "42.000" },
  { title: "Planta", price: "35000" },
];

async function party(n: number, expected = n) {
  const org = await makeAccount("Org", "org@example.com");
  const res = await createGroup(
    mkReq("POST", "/api/groups", { groupName: "Fam", priceCap: 60000, expectedSize: expected, ...org.fields }),
  );
  const { inviteCode } = await res.json();
  const members: Member[] = [{ acct: org, cookie: sessionCookie(res), id: "" }];
  for (let i = 1; i < n; i++) {
    const a = await makeAccount(`Persona${i}`, `p${i}@example.com`);
    const r = await join(mkReq("POST", "/api/join", { inviteCode, ...a.fields }));
    members.push({ acct: a, cookie: sessionCookie(r), id: "" });
  }
  for (const m of members) m.id = (await (await me(mkReq("GET", "/api/me", undefined, m.cookie))).json()).user.id;
  return { members, org: members[0], inviteCode };
}

const save = (m: Member, wishes: unknown = okWishes) =>
  putWishes(mkReq("PUT", "/api/wishes", { wishes }, m.cookie));

async function allReady(n: number, expected = n) {
  const p = await party(n, expected);
  for (const m of p.members) expect((await save(m)).status).toBe(200);
  return p;
}

async function doDraw(org: Member) {
  const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, org.cookie))).json();
  const results = await buildDraw(inputs);
  return postDraw(mkReq("POST", "/api/draw", { results }, org.cookie));
}

beforeEach(async () => {
  await resetDb();
});

describe("wishes", () => {
  test("saves three wishes and /api/me returns them in order, replacing earlier ones", async () => {
    const { org } = await party(2);
    expect((await save(org)).status).toBe(200);
    const mine = await (await me(mkReq("GET", "/api/me", undefined, org.cookie))).json();
    expect(mine.wishes).toEqual([
      { title: "Libro de recetas", price: 48000, link: "tienda.com/libro" },
      { title: "Taza térmica", price: 42000, link: null },
      { title: "Planta", price: 35000, link: null },
    ]);
    const next = [okWishes[2], okWishes[1], okWishes[0]];
    expect((await save(org, next)).status).toBe(200);
    const again = await (await me(mkReq("GET", "/api/me", undefined, org.cookie))).json();
    expect(again.wishes.map((w: { title: string }) => w.title)).toEqual(["Planta", "Taza térmica", "Libro de recetas"]);
  });

  test("a price over the group cap is rejected with the field name", async () => {
    const { org } = await party(2);
    const r = await save(org, [okWishes[0], { title: "Audífonos", price: "$75.000" }, okWishes[2]]);
    expect(r.status).toBe(422);
    const body = await r.json();
    expect(body.field).toBe("wishes.1.price");
    expect(body.error).toMatch(/\$60\.000/);
  });

  test.each([["abc"], ["-5"], ["0"], [""]])("an invalid price %j is rejected", async (price) => {
    const { org } = await party(2);
    const r = await save(org, [okWishes[0], { title: "X", price }, okWishes[2]]);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes.1.price");
  });

  test("fewer than three wishes, or an empty title, is rejected", async () => {
    const { org } = await party(2);
    expect((await save(org, okWishes.slice(0, 2))).status).toBe(422);
    const r = await save(org, [okWishes[0], { title: "  ", price: "1000" }, okWishes[2]]);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes.1.title");
  });

  test("a title over 120 characters or a link over 500 is rejected", async () => {
    const { org } = await party(2);
    const longTitle = await save(org, [{ ...okWishes[0], title: "a".repeat(121) }, okWishes[1], okWishes[2]]);
    expect(longTitle.status).toBe(422);
    const longLink = await save(org, [{ ...okWishes[0], link: "a".repeat(501) }, okWishes[1], okWishes[2]]);
    expect(longLink.status).toBe(422);
  });

  test("wishes within every per-field cap but too many UTF-8 bytes for the encrypted snapshot are rejected", async () => {
    const { org } = await party(2);
    // 3-byte characters: 120-char titles and 500-char links pass the caps, but 3 × (360 + 1500) bytes > 4092.
    const heavy = okWishes.map((w) => ({ ...w, title: "漢".repeat(120), link: "漢".repeat(500) }));
    const r = await save(org, heavy);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes");
  });

  test("a maximum-length accented member still fits", async () => {
    const { org } = await party(2);
    const max = { title: "ñ".repeat(120), price: "60000", link: "á".repeat(500) };
    expect((await save(org, [max, max, max])).status).toBe(200);
  });

  test("wishes are locked once the draw is done", async () => {
    const p = await allReady(3);
    expect((await doDraw(p.org)).status).toBe(200);
    expect((await save(p.members[1])).status).toBe(409);
  });
});

describe("group status and draw gate", () => {
  test("canDraw only when everyone expected has joined and every list is complete; no keys are exposed", async () => {
    const p = await party(3, 4);
    for (const m of p.members) await save(m);
    let g = await (await groupStatus(mkReq("GET", "/api/group", undefined, p.org.cookie))).json();
    expect(g).toMatchObject({ expectedSize: 4, readyCount: 3, drawDone: false, canDraw: false });
    expect(g.members).toHaveLength(3);
    expect(JSON.stringify(g)).not.toMatch(/publicKey|public_key|wrapped/);

    const late = await makeAccount("Tardía", "late@example.com");
    const code = (await (await me(mkReq("GET", "/api/me", undefined, p.org.cookie))).json()).group.inviteCode;
    const r = await join(mkReq("POST", "/api/join", { inviteCode: code, ...late.fields }));
    g = await (await groupStatus(mkReq("GET", "/api/group", undefined, p.org.cookie))).json();
    expect(g).toMatchObject({ readyCount: 3, canDraw: false });
    await save({ acct: late, cookie: sessionCookie(r), id: "" });
    g = await (await groupStatus(mkReq("GET", "/api/group", undefined, p.org.cookie))).json();
    expect(g).toMatchObject({ readyCount: 4, canDraw: true });
  });

  test("/api/group requires a session", async () => {
    expect((await groupStatus(mkReq("GET", "/api/group"))).status).toBe(401);
  });
});

describe("draw", () => {
  test("non-organizers cannot read inputs, draw, reset or remove members", async () => {
    const p = await allReady(3);
    const other = p.members[1];
    expect((await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, other.cookie))).status).toBe(403);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: [] }, other.cookie))).status).toBe(403);
    expect((await resetDraw(mkReq("DELETE", "/api/draw", undefined, other.cookie))).status).toBe(403);
    const rm = await removeMember(mkReq("DELETE", "/api/members/x", undefined, other.cookie), {
      params: Promise.resolve({ id: p.members[2].id }),
    });
    expect(rm.status).toBe(403);
  });

  test("inputs are refused until the draw is possible", async () => {
    const p = await party(3);
    await save(p.members[0]);
    expect((await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie))).status).toBe(409);
  });

  test("a full draw: everyone opens their own result and it is a valid derangement", async () => {
    const p = await allReady(4);
    expect((await doDraw(p.org)).status).toBe(200);
    const names = new Set<string>();
    for (const m of p.members) {
      const r = await getResult(mkReq("GET", "/api/result", undefined, m.cookie));
      expect(r.status).toBe(200);
      const { sealed } = await r.json();
      const payload = await openPayload<{ receiverName: string; wishes: unknown[] }>(sealed, m.acct.privateKey);
      expect(payload.receiverName).not.toBe(m.acct.name);
      expect(payload.wishes).toHaveLength(3);
      names.add(payload.receiverName);
    }
    expect(names.size).toBe(4);
    const g = await (await groupStatus(mkReq("GET", "/api/group", undefined, p.org.cookie))).json();
    expect(g).toMatchObject({ drawDone: true, canDraw: false });
  });

  test("a result is only returned to its owner and 404s before the draw", async () => {
    const p = await allReady(3);
    expect((await getResult(mkReq("GET", "/api/result", undefined, p.org.cookie))).status).toBe(404);
    await doDraw(p.org);
    const a = await (await getResult(mkReq("GET", "/api/result", undefined, p.members[1].cookie))).json();
    const b = await (await getResult(mkReq("GET", "/api/result", undefined, p.members[2].cookie))).json();
    expect(a.sealed).not.toBe(b.sealed);
    await expect(openPayload(a.sealed, p.members[2].acct.privateKey)).rejects.toBeDefined();
  });

  test("a draw missing a giver, with an unknown giver, or with duplicates is rejected", async () => {
    const p = await allReady(3);
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie))).json();
    const results = await buildDraw(inputs);
    const post = (r: unknown) => postDraw(mkReq("POST", "/api/draw", { results: r }, p.org.cookie));
    expect((await post(results.slice(1))).status).toBe(422);
    expect((await post([...results.slice(1), { giverId: "00000000-0000-0000-0000-000000000000", sealed: "x" }])).status).toBe(422);
    expect((await post([...results.slice(1), results[1]])).status).toBe(422);
    const none = await sql`SELECT count(*)::int AS n FROM results`;
    expect(none[0].n).toBe(0);
  });

  test("drawing twice is a conflict", async () => {
    const p = await allReady(3);
    expect((await doDraw(p.org)).status).toBe(200);
    const inputs = await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.org.cookie));
    expect(inputs.status).toBe(409);
  });

  test("reset clears results and allows a new draw", async () => {
    const p = await allReady(3);
    await doDraw(p.org);
    expect((await resetDraw(mkReq("DELETE", "/api/draw", undefined, p.org.cookie))).status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await getResult(mkReq("GET", "/api/result", undefined, p.members[1].cookie))).status).toBe(404);
    expect((await doDraw(p.org)).status).toBe(200);
  });

  test("joining after the draw is done is rejected", async () => {
    const p = await allReady(3, 4);
    // expected 4 but only 3: lower to 3 so the draw can run, then try to add a fourth via a raised cap
    const { PATCH } = await import("./groups/route");
    await PATCH(mkReq("PATCH", "/api/groups", { expectedSize: 3 }, p.org.cookie));
    expect((await doDraw(p.org)).status).toBe(200);
    const code = (await (await me(mkReq("GET", "/api/me", undefined, p.org.cookie))).json()).group.inviteCode;
    const late = await makeAccount("Tardía", "late@example.com");
    const r = await join(mkReq("POST", "/api/join", { inviteCode: code, ...late.fields }));
    expect(r.status).toBe(409);
  });
});

describe("removing a member", () => {
  test("removes the member and resets any draw, so a smaller group can draw", async () => {
    const p = await allReady(4);
    await doDraw(p.org);
    const gone = p.members[3];
    const r = await removeMember(mkReq("DELETE", `/api/members/${gone.id}`, undefined, p.org.cookie), {
      params: Promise.resolve({ id: gone.id }),
    });
    expect(r.status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await me(mkReq("GET", "/api/me", undefined, gone.cookie))).status).toBe(401);
    const { PATCH } = await import("./groups/route");
    expect((await PATCH(mkReq("PATCH", "/api/groups", { expectedSize: 3 }, p.org.cookie))).status).toBe(200);
    expect((await doDraw(p.org)).status).toBe(200);
  });

  test("the organizer cannot remove themselves, and members of other groups cannot be removed", async () => {
    const p = await allReady(3);
    const self = await removeMember(mkReq("DELETE", `/api/members/${p.org.id}`, undefined, p.org.cookie), {
      params: Promise.resolve({ id: p.org.id }),
    });
    expect(self.status).toBe(422);
    const ghost = await removeMember(mkReq("DELETE", "/api/members/x", undefined, p.org.cookie), {
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(ghost.status).toBe(404);
  });
});
