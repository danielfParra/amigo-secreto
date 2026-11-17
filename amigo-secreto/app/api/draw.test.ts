import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, createFamily, drawBody, claim, claimAll, readyFamily, saveWishes, okWishes, type Family, type Person } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { openPayload, payloadFits } from "@/lib/crypto/hybrid";
import { GET as me } from "./me/route";
import { GET as groupStatus } from "./group/route";
import { GET as drawInputs } from "./draw/inputs/route";
import { POST as postDraw, DELETE as resetDraw } from "./draw/route";
import { GET as getResult } from "./result/route";
import { POST as addMember } from "./members/route";
import { DELETE as removeMember } from "./members/[id]/route";

const status = async (p: Person) => (await groupStatus(mkReq("GET", "/api/group", undefined, p.cookie))).json();
const inputs = (p: Person) => drawInputs(mkReq("GET", "/api/draw/inputs", undefined, p.cookie));
const remove = (actor: Person, id: string) =>
  removeMember(mkReq("DELETE", `/api/members/${id}`, undefined, actor.cookie), { params: Promise.resolve({ id }) });

async function doDraw(org: Person) {
  return postDraw(mkReq("POST", "/api/draw", await drawBody(await (await inputs(org)).json()), org.cookie));
}

beforeEach(async () => {
  await resetDb();
});

describe("wishes", () => {
  test("saves three wishes and /api/me returns them in order, replacing earlier ones", async () => {
    const fam = await createFamily({ size: 2 });
    expect((await saveWishes(fam.org)).status).toBe(200);
    const mine = await (await me(mkReq("GET", "/api/me", undefined, fam.org.cookie))).json();
    expect(mine.wishes).toEqual([
      { title: "Libro de recetas", price: 48000, link: "tienda.com/libro" },
      { title: "Taza térmica", price: 42000, link: null },
      { title: "Planta", price: 35000, link: null },
    ]);
    expect((await saveWishes(fam.org, [okWishes[2], okWishes[1], okWishes[0]])).status).toBe(200);
    const again = await (await me(mkReq("GET", "/api/me", undefined, fam.org.cookie))).json();
    expect(again.wishes.map((w: { title: string }) => w.title)).toEqual(["Planta", "Taza térmica", "Libro de recetas"]);
  });

  test("a price over the group cap is rejected with the field name", async () => {
    const fam = await createFamily({ size: 2 });
    const r = await saveWishes(fam.org, [okWishes[0], { title: "Audífonos", price: "$75.000" }, okWishes[2]]);
    expect(r.status).toBe(422);
    const body = await r.json();
    expect(body.field).toBe("wishes.1.price");
    expect(body.error).toMatch(/\$60\.000/);
  });

  test.each([["abc"], ["-5"], ["0"], [""]])("an invalid price %j is rejected", async (price) => {
    const fam = await createFamily({ size: 2 });
    const r = await saveWishes(fam.org, [okWishes[0], { title: "X", price }, okWishes[2]]);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes.1.price");
  });

  test("fewer than three wishes, or an empty title, is rejected", async () => {
    const fam = await createFamily({ size: 2 });
    expect((await saveWishes(fam.org, okWishes.slice(0, 2))).status).toBe(422);
    const r = await saveWishes(fam.org, [okWishes[0], { title: "  ", price: "1000" }, okWishes[2]]);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes.1.title");
  });

  test("a title over 120 characters or a link over 500 is rejected", async () => {
    const fam = await createFamily({ size: 2 });
    expect((await saveWishes(fam.org, [{ ...okWishes[0], title: "a".repeat(121) }, okWishes[1], okWishes[2]])).status).toBe(422);
    expect((await saveWishes(fam.org, [{ ...okWishes[0], link: "a".repeat(501) }, okWishes[1], okWishes[2]])).status).toBe(422);
  });

  test("wishes within every per-field cap but too many UTF-8 bytes for the encrypted snapshot are rejected", async () => {
    const fam = await createFamily({ size: 2 });
    // 3-byte characters: 120-char titles and 500-char links pass the caps, but 3 × (360 + 1500) bytes > 4092.
    const heavy = okWishes.map((w) => ({ ...w, title: "漢".repeat(120), link: "漢".repeat(500) }));
    const r = await saveWishes(fam.org, heavy);
    expect(r.status).toBe(422);
    expect((await r.json()).field).toBe("wishes");
  });

  test("a 60-character accented name with maximum-length accented wishes still fits", async () => {
    const longName = "é".repeat(60);
    const fam = await createFamily({ names: [longName, "Persona B"], organizer: longName });
    const max = { title: "ñ".repeat(120), price: "60000", link: "á".repeat(500) };
    expect((await saveWishes(fam.org, [max, max, max])).status).toBe(200);
  });

  test("wishes are locked once the draw is done", async () => {
    const fam = await readyFamily(3);
    expect((await doDraw(fam.org)).status).toBe(200);
    expect((await saveWishes(fam.people[1])).status).toBe(409);
  });
});

describe("group status and draw gate", () => {
  test("lists everyone alphabetically with claimed/ready flags and exposes no keys", async () => {
    const names = ["Zulema Gil", "Ñandú Pérez", "Nicolás Ruiz", "Ángela Soto"];
    const fam = await createFamily({ names, organizer: "Zulema Gil" });
    const s = await status(fam.org);
    expect(s.members.map((m: { name: string }) => m.name)).toEqual(["Ángela Soto", "Nicolás Ruiz", "Ñandú Pérez", "Zulema Gil"]);
    expect(s.members.map((m: { claimed: boolean }) => m.claimed)).toEqual([false, false, false, true]);
    expect(s.size).toBe(4);
    expect(JSON.stringify(s)).not.toMatch(/publicKey|public_key|wrapped|salt|hash|invite/i);
  });

  test("canDraw needs every name claimed AND every list complete", async () => {
    const fam = await createFamily({ size: 3 });
    for (const p of fam.people.filter((x) => x.creds)) await saveWishes(p);
    expect(await status(fam.org)).toMatchObject({ readyCount: 1, canDraw: false });

    const [, b, c] = fam.people;
    await claim(fam, b);
    await saveWishes(b);
    expect((await status(fam.org)).canDraw).toBe(false); // c has not joined

    await claim(fam, c);
    expect((await status(fam.org)).canDraw).toBe(false); // c has no wishes
    await saveWishes(c);
    expect(await status(fam.org)).toMatchObject({ readyCount: 3, canDraw: true });
  });

  test("a roster of one person cannot draw", async () => {
    const fam = await createFamily({ size: 2 });
    await claimAll(fam);
    for (const p of fam.people) await saveWishes(p);
    expect((await remove(fam.org, fam.people[1].id)).status).toBe(200);
    expect((await status(fam.org)).canDraw).toBe(false);
  });

  test("a person added later blocks the draw until they join and finish their list", async () => {
    const fam = await readyFamily(3);
    expect((await status(fam.org)).canDraw).toBe(true);
    await addMember(mkReq("POST", "/api/members", { name: "Zoe Nueva" }, fam.org.cookie));
    expect((await status(fam.org)).canDraw).toBe(false);
    expect((await inputs(fam.org)).status).toBe(409);
  });

  test("/api/group requires a session", async () => {
    expect((await groupStatus(mkReq("GET", "/api/group"))).status).toBe(401);
  });
});

describe("draw", () => {
  test("non-organizers cannot read inputs, draw, reset, remove or add", async () => {
    const fam = await readyFamily(3);
    const other = fam.people[1];
    expect((await inputs(other)).status).toBe(403);
    expect((await postDraw(mkReq("POST", "/api/draw", { results: [] }, other.cookie))).status).toBe(403);
    expect((await resetDraw(mkReq("DELETE", "/api/draw", undefined, other.cookie))).status).toBe(403);
    expect((await remove(other, fam.people[2].id)).status).toBe(403);
    expect((await addMember(mkReq("POST", "/api/members", { name: "Zoe" }, other.cookie))).status).toBe(403);
  });

  test("inputs are refused until the draw is possible", async () => {
    const fam = await createFamily({ size: 3 });
    await saveWishes(fam.org);
    expect((await inputs(fam.org)).status).toBe(409);
  });

  test("a full draw: everyone opens their own result and it is a valid derangement", async () => {
    const fam = await readyFamily(4);
    expect((await doDraw(fam.org)).status).toBe(200);
    const names = new Set<string>();
    for (const p of fam.people) {
      const r = await getResult(mkReq("GET", "/api/result", undefined, p.cookie));
      expect(r.status).toBe(200);
      const { sealed } = await r.json();
      const payload = await openPayload<{ receiverName: string; wishes: unknown[] }>(sealed, p.creds!.privateKey);
      expect(payload.receiverName).not.toBe(p.name);
      expect(payload.wishes).toHaveLength(3);
      names.add(payload.receiverName);
    }
    expect(names.size).toBe(4);
    expect(await status(fam.org)).toMatchObject({ drawDone: true, canDraw: false });
  });

  test("a result is only returned to its owner and 404s before the draw", async () => {
    const fam = await readyFamily(3);
    expect((await getResult(mkReq("GET", "/api/result", undefined, fam.org.cookie))).status).toBe(404);
    await doDraw(fam.org);
    const a = await (await getResult(mkReq("GET", "/api/result", undefined, fam.people[1].cookie))).json();
    const b = await (await getResult(mkReq("GET", "/api/result", undefined, fam.people[2].cookie))).json();
    expect(a.sealed).not.toBe(b.sealed);
    await expect(openPayload(a.sealed, fam.people[2].creds!.privateKey)).rejects.toBeDefined();
  });

  test("a draw missing a giver, with an unknown giver, or with duplicates is rejected", async () => {
    const fam = await readyFamily(3);
    const full = await drawBody(await (await inputs(fam.org)).json());
    const results = full.results;
    const post = (r: unknown) => postDraw(mkReq("POST", "/api/draw", { ...full, results: r }, fam.org.cookie));
    expect((await post(results.slice(1))).status).toBe(422);
    expect((await post([...results.slice(1), { giverId: "00000000-0000-0000-0000-000000000000", sealed: "x" }])).status).toBe(422);
    expect((await post([...results.slice(1), results[1]])).status).toBe(422);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
  });

  test("drawing twice is a conflict", async () => {
    const fam = await readyFamily(3);
    expect((await doDraw(fam.org)).status).toBe(200);
    expect((await inputs(fam.org)).status).toBe(409);
  });

  test("reset clears results and allows a new draw", async () => {
    const fam = await readyFamily(3);
    await doDraw(fam.org);
    expect((await resetDraw(mkReq("DELETE", "/api/draw", undefined, fam.org.cookie))).status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await getResult(mkReq("GET", "/api/result", undefined, fam.people[1].cookie))).status).toBe(404);
    expect((await doDraw(fam.org)).status).toBe(200);
  });

  test("adding a person after the draw reopens it, and they cannot be left out", async () => {
    const fam = await readyFamily(3);
    expect((await doDraw(fam.org)).status).toBe(200);
    const r = await addMember(mkReq("POST", "/api/members", { name: "Zoe Nueva" }, fam.org.cookie));
    expect(r.status).toBe(201);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect(await status(fam.org)).toMatchObject({ drawDone: false, canDraw: false });
    expect((await getResult(mkReq("GET", "/api/result", undefined, fam.people[1].cookie))).status).toBe(404);
  });
});

describe("removing a member", () => {
  test("removes the member and resets any draw, so a smaller group can draw", async () => {
    const fam = await readyFamily(4);
    await doDraw(fam.org);
    const gone = fam.people[3];
    expect((await remove(fam.org, gone.id)).status).toBe(200);
    expect((await sql`SELECT count(*)::int AS n FROM results`)[0].n).toBe(0);
    expect((await me(mkReq("GET", "/api/me", undefined, gone.cookie))).status).toBe(401);
    expect((await doDraw(fam.org)).status).toBe(200);
  });

  test("an unclaimed name can be removed and the rest can then draw", async () => {
    const fam = await createFamily({ size: 4 });
    const [, b, c] = fam.people;
    await claim(fam, b);
    await claim(fam, c);
    for (const p of [fam.org, b, c]) await saveWishes(p);
    expect((await status(fam.org)).canDraw).toBe(false);
    expect((await remove(fam.org, fam.people[3].id)).status).toBe(200);
    expect((await status(fam.org)).canDraw).toBe(true);
  });

  test("the organizer cannot remove themselves, and an unknown id is 404", async () => {
    const fam = await readyFamily(3);
    expect((await remove(fam.org, fam.org.id)).status).toBe(422);
    expect((await remove(fam.org, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await remove(fam.org, "not-a-uuid")).status).toBe(404);
  });
});

export type { Family };

describe("wishes and the chat key", () => {
  test("wishes that fit the encrypted snapshot only without the chat key are rejected, so the draw can always seal them", async () => {
    const fam = await createFamily({ size: 2 });
    const thread = { id: "0".repeat(32), key: "A".repeat(44) };
    const mk = (n: number) => okWishes.map((w) => ({ ...w, title: "漢".repeat(120), link: "漢".repeat(n) }));
    const snap = (n: number, withThread: boolean) => ({
      receiverName: fam.org.name,
      wishes: mk(n).map((w) => ({ title: w.title, price: 1000, link: w.link })),
      ...(withThread ? { thread } : {}),
    });
    let n = 0;
    while (n < 500 && payloadFits(snap(n + 1, false))) n++;
    const edge = n; // the longest link that fits without the thread; the thread (~100 bytes) cannot also fit in the few bytes left
    expect(payloadFits(snap(edge, false))).toBe(true);
    expect(payloadFits(snap(edge, true))).toBe(false);
    const r = await saveWishes(fam.org, mk(edge));
    expect(r.status).toBe(422);
  });
});
