import "@/tests/db-guard";
import { describe, test, expect, beforeEach } from "vitest";
import { resetDb } from "@/tests/reset-db";
import { mkReq, drawBody, readyFamily, type Person } from "@/tests/helpers";
import { sql } from "@/lib/db";
import { openPayload } from "@/lib/crypto/hybrid";
import { sealMessage, openMessage, threadHash, type Thread } from "@/lib/crypto/chat";
import { GET as drawInputs } from "./draw/inputs/route";
import { POST as postDraw, DELETE as resetDraw } from "./draw/route";
import { GET as getResult } from "./result/route";
import { GET as getInbox } from "./inbox/route";
import { POST as chatSend } from "./chat/send/route";
import { POST as chatRead } from "./chat/read/route";
import { POST as startReset } from "./members/[id]/reset-pin/route";

beforeEach(async () => {
  await resetDb();
});

async function drawnFamily(size = 3) {
  const fam = await readyFamily(size);
  const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json();
  const body = await drawBody(inputs);
  expect((await postDraw(mkReq("POST", "/api/draw", body, fam.org.cookie))).status).toBe(200);
  return { fam, body };
}

/** Everything one person can learn: who they give to (and that chat), and the chat with whoever gives to them. */
async function mine(p: Person) {
  const r = await (await getResult(mkReq("GET", "/api/result", undefined, p.cookie))).json();
  const i = await (await getInbox(mkReq("GET", "/api/inbox", undefined, p.cookie))).json();
  const asGiver = await openPayload<{ receiverName: string; thread: Thread }>(r.sealed, p.creds!.privateKey);
  const asReceiver = await openPayload<{ thread: Thread }>(i.sealed, p.creds!.privateKey);
  return { toThread: asGiver.thread, fromThread: asReceiver.thread, receiverName: asGiver.receiverName };
}

const send = (t: Thread, sealed: string, cookie = "") => chatSend(mkReq("POST", "/api/chat/send", { threadId: t.id, sealed }, cookie));
const read = (t: Thread, after?: number, cookie = "") => chatRead(mkReq("POST", "/api/chat/read", { threadId: t.id, after }, cookie));

describe("the draw stores chat records", () => {
  test("one inbox record and one thread per person, and each person opens only their own", async () => {
    const { fam } = await drawnFamily(3);
    expect((await sql`SELECT count(*)::int AS n FROM inbox`)[0].n).toBe(3);
    expect((await sql`SELECT count(*)::int AS n FROM chat_threads`)[0].n).toBe(3);
    const a = await mine(fam.people[0]);
    const other = await (await getInbox(mkReq("GET", "/api/inbox", undefined, fam.people[1].cookie))).json();
    await expect(openPayload(other.sealed, fam.people[0].creds!.privateKey)).rejects.toBeDefined();
    expect(a.toThread.id).toMatch(/^[0-9a-f]{32}$/);
  });

  test("the inbox is 404 before the draw and needs a session", async () => {
    const fam = await readyFamily(3);
    expect((await getInbox(mkReq("GET", "/api/inbox", undefined, fam.org.cookie))).status).toBe(404);
    expect((await getInbox(mkReq("GET", "/api/inbox"))).status).toBe(401);
  });

  test.each([
    ["no inbox", (b: Awaited<ReturnType<typeof drawBody>>) => ({ results: b.results, threads: b.threads })],
    ["no threads", (b: Awaited<ReturnType<typeof drawBody>>) => ({ results: b.results, inbox: b.inbox })],
    ["too few inbox records", (b: Awaited<ReturnType<typeof drawBody>>) => ({ ...b, inbox: b.inbox.slice(1) })],
    ["a repeated receiver", (b: Awaited<ReturnType<typeof drawBody>>) => ({ ...b, inbox: [b.inbox[0], b.inbox[0], b.inbox[2]] })],
    ["a repeated thread", (b: Awaited<ReturnType<typeof drawBody>>) => ({ ...b, threads: [b.threads[0], b.threads[0], b.threads[2]] })],
    ["a malformed thread hash", (b: Awaited<ReturnType<typeof drawBody>>) => ({ ...b, threads: ["nope", b.threads[1], b.threads[2]] })],
  ])("a draw with %s is rejected and stores nothing", async (_n, mutate) => {
    const fam = await readyFamily(3);
    const inputs = await (await drawInputs(mkReq("GET", "/api/draw/inputs", undefined, fam.org.cookie))).json();
    const res = await postDraw(mkReq("POST", "/api/draw", mutate(await drawBody(inputs)), fam.org.cookie));
    expect(res.status).toBe(422);
    for (const t of ["results", "inbox", "chat_threads"]) {
      expect((await sql.query(`SELECT count(*)::int AS n FROM ${t}`))[0].n).toBe(0);
    }
  });
});

describe("chat", () => {
  test("a message from the giver reaches the receiver, who answers on the same thread", async () => {
    const { fam } = await drawnFamily(3);
    const giver = fam.people[0];
    const g = await mine(giver);
    const receiver = fam.people.find((p) => p.name === g.receiverName)!;
    const r = await mine(receiver);
    expect(r.fromThread).toEqual(g.toThread);

    expect((await send(g.toThread, await sealMessage(g.toThread.key, "g", "¿Qué color te gusta?"))).status).toBe(201);
    const got = await (await read(r.fromThread)).json();
    expect(got.messages).toHaveLength(1);
    expect(await openMessage(r.fromThread.key, got.messages[0].sealed)).toMatchObject({ role: "g", text: "¿Qué color te gusta?" });

    expect((await send(r.fromThread, await sealMessage(r.fromThread.key, "r", "El verde"))).status).toBe(201);
    const after = await (await read(g.toThread, got.messages[0].id)).json();
    expect(after.messages).toHaveLength(1);
    expect(await openMessage(g.toThread.key, after.messages[0].sealed)).toMatchObject({ role: "r", text: "El verde" });
  });

  test("it works with no cookie at all and the cookie changes nothing", async () => {
    const { fam } = await drawnFamily(3);
    const g = await mine(fam.people[0]);
    const s = await sealMessage(g.toThread.key, "g", "hola");
    expect((await send(g.toThread, s)).status).toBe(201);
    expect((await send(g.toThread, s, fam.people[1].cookie)).status).toBe(201);
    const noCookie = await (await read(g.toThread)).json();
    const withCookie = await (await read(g.toThread, undefined, fam.people[2].cookie)).json();
    expect(noCookie).toEqual(withCookie);
  });

  test("an unknown or malformed thread is refused and creates nothing", async () => {
    await drawnFamily(3);
    const ghost: Thread = { id: "0".repeat(32), key: "" };
    expect((await send(ghost, "x")).status).toBe(404);
    expect((await read(ghost)).status).toBe(404);
    expect((await send({ id: "not-hex", key: "" }, "x")).status).toBe(422);
    expect((await sql`SELECT count(*)::int AS n FROM chat_messages`)[0].n).toBe(0);
    expect((await sql`SELECT count(*)::int AS n FROM chat_threads`)[0].n).toBe(3);
  });

  test("an oversized or empty sealed message is refused", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    expect((await send(g, "a".repeat(6001))).status).toBe(422);
    expect((await send(g, "")).status).toBe(422);
  });

  test("a thread holds at most 300 messages", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    const s = await sealMessage(g.key, "g", "x");
    await sql.query(
      `INSERT INTO chat_messages (thread_hash, sealed) SELECT $1, $2 FROM generate_series(1, 300)`,
      [await threadHash(g.id), s],
    );
    expect((await send(g, s)).status).toBe(409);
  });

  test("the server stores the thread id only as a hash and messages carry no author", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    await send(g, await sealMessage(g.key, "g", "hola"));
    const hashes = (await sql`SELECT thread_hash FROM chat_threads`).map((r) => r.thread_hash);
    expect(hashes).toContain(await threadHash(g.id));
    expect(hashes).not.toContain(g.id);
    const cols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages' ORDER BY column_name`).map((r) => r.column_name);
    expect(cols).toEqual(["created_at", "id", "sealed", "thread_hash"]);
  });

  test("messages come back oldest first, and `after` returns only the newer ones", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    for (const t of ["uno", "dos", "tres"]) await send(g, await sealMessage(g.key, "g", t));
    const all = (await (await read(g)).json()).messages;
    const texts = await Promise.all(all.map(async (m: { sealed: string }) => (await openMessage(g.key, m.sealed)).text));
    expect(texts).toEqual(["uno", "dos", "tres"]);
    expect((await (await read(g, all[1].id)).json()).messages).toHaveLength(1);
  });
});

describe("a new draw never inherits old chats", () => {
  async function chatRows() {
    return Promise.all(["inbox", "chat_threads", "chat_messages"].map(async (t) => (await sql.query(`SELECT count(*)::int AS n FROM ${t}`))[0].n as number));
  }

  test("redoing the draw deletes inbox records, threads and messages", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    await send(g, await sealMessage(g.key, "g", "hola"));
    expect(await chatRows()).toEqual([3, 3, 1]);
    expect((await resetDraw(mkReq("DELETE", "/api/draw", undefined, fam.org.cookie))).status).toBe(200);
    expect(await chatRows()).toEqual([0, 0, 0]);
    expect((await read(g)).status).toBe(404);
  });

  test("a PIN reset after the draw also deletes them, because the draw is reopened", async () => {
    const { fam } = await drawnFamily(3);
    const g = (await mine(fam.people[0])).toThread;
    await send(g, await sealMessage(g.key, "g", "hola"));
    const victim = fam.people[1];
    const res = await startReset(mkReq("POST", `/api/members/${victim.id}/reset-pin`, {}, fam.org.cookie), { params: Promise.resolve({ id: victim.id }) });
    expect(res.status).toBe(200);
    expect(await chatRows()).toEqual([0, 0, 0]);
  });
});

