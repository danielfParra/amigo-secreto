import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, readyFamily, drawBody, type Person } from "@/tests/helpers";
import { GET as inputs } from "./draw/inputs/route";
import { POST as postDraw } from "./draw/route";
import { DELETE as removeMember } from "./members/[id]/route";
import { GET as list, POST as add, DELETE as drop } from "./restrictions/route";

const call = (fn: typeof add, method: string, p: Person, body?: unknown) => fn(mkReq(method, "/api/restrictions", body, p.cookie));
const pair = (g: Person, r: Person) => ({ giverId: g.id, receiverId: r.id });
const listFor = async (p: Person) => (await list(mkReq("GET", "/api/restrictions", undefined, p.cookie))).json();

beforeEach(async () => {
  await resetDb();
});

describe("restrictions", () => {
  test("the organizer adds, lists and removes a pair", async () => {
    const fam = await readyFamily(4);
    const [, a, b] = fam.people;
    expect((await call(add, "POST", fam.org, pair(a, b))).status).toBe(201);
    expect(await listFor(fam.org)).toEqual([pair(a, b)]);
    expect((await call(drop, "DELETE", fam.org, pair(a, b))).status).toBe(200);
    expect(await listFor(fam.org)).toEqual([]);
  });

  test("a non-organizer can neither read nor change them", async () => {
    const fam = await readyFamily(4);
    const [, a, b] = fam.people;
    expect((await list(mkReq("GET", "/api/restrictions", undefined, a.cookie))).status).toBe(403);
    expect((await call(add, "POST", a, pair(a, b))).status).toBe(403);
    expect((await call(drop, "DELETE", a, pair(a, b))).status).toBe(403);
  });

  test("rejects bad ids, people outside the group, self pairs and duplicates", async () => {
    const fam = await readyFamily(4);
    const [, a, b] = fam.people;
    expect((await call(add, "POST", fam.org, { giverId: "x", receiverId: b.id })).status).toBe(422);
    expect((await call(add, "POST", fam.org, pair(a, a))).status).toBe(422);
    const stranger = "00000000-0000-4000-8000-000000000000";
    expect((await call(add, "POST", fam.org, { giverId: a.id, receiverId: stranger })).status).toBe(404);
    expect((await call(add, "POST", fam.org, pair(a, b))).status).toBe(201);
    expect((await call(add, "POST", fam.org, pair(a, b))).status).toBe(409);
  });

  test("refuses a restriction that leaves someone with nobody to give to", async () => {
    const fam = await readyFamily(3); // each person can give to 2 others; one restriction is fine, two is not
    const [o, a, b] = fam.people;
    expect((await call(add, "POST", fam.org, pair(a, b))).status).toBe(201);
    expect((await call(add, "POST", fam.org, pair(a, o))).status).toBe(422);
  });

  test("cannot be changed after the draw", async () => {
    const fam = await readyFamily(4);
    const [, a, b] = fam.people;
    const body = await drawBody(await (await inputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json());
    expect((await postDraw(mkReq("POST", "/api/draw", body, fam.org.cookie))).status).toBe(200);
    expect((await call(add, "POST", fam.org, pair(a, b))).status).toBe(409);
    expect((await call(drop, "DELETE", fam.org, pair(a, b))).status).toBe(409);
  });

  test("removing a member removes their restrictions", async () => {
    const fam = await readyFamily(5);
    const [, a, b] = fam.people;
    await call(add, "POST", fam.org, pair(a, b));
    const res = await removeMember(mkReq("DELETE", `/api/members/${b.id}`, undefined, fam.org.cookie), { params: Promise.resolve({ id: b.id }) });
    expect(res.status).toBe(200);
    expect(await listFor(fam.org)).toEqual([]);
  });
});
