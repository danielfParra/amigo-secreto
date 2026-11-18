import { describe, test, expect } from "vitest";
import { derangement, buildDraw, buildDrawWithChat, forbiddenFor, type Wish } from "./draw";
import { generateKeyPair, exportPublicKey } from "./crypto/keys";
import { openPayload, PAD_SIZE } from "./crypto/hybrid";

describe("derangement", () => {
  test("has no fixed points for n=2..50 over 200 runs each", () => {
    let fixedPoints = 0;
    for (let n = 2; n <= 50; n++) {
      for (let r = 0; r < 200; r++) {
        const p = derangement(n);
        for (let i = 0; i < n; i++) if (p[i] === i) fixedPoints++;
      }
    }
    expect(fixedPoints).toBe(0);
  }, 20_000);

  test("is a permutation (each index exactly once)", () => {
    for (let r = 0; r < 200; r++) {
      const p = derangement(12);
      expect([...p].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    }
  });

  test("n=2 always swaps", () => {
    for (let r = 0; r < 50; r++) expect(derangement(2)).toEqual([1, 0]);
  });

  test("n<2 throws", () => {
    expect(() => derangement(1)).toThrow();
    expect(() => derangement(0)).toThrow();
  });
});

describe("restrictions", () => {
  const members = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  test("forbidden pairs never come out of the draw", () => {
    const forbidden = forbiddenFor(members, [
      { giverId: "a", receiverId: "c" },
      { giverId: "b", receiverId: "c" },
    ]);
    for (let r = 0; r < 2000; r++) {
      const p = derangement(members.length, undefined, forbidden);
      expect(p[0]).not.toBe(2);
      expect(p[1]).not.toBe(2);
    }
  });

  test("a restriction about someone outside the draw fails loudly instead of being skipped", () => {
    expect(() => forbiddenFor(members, [{ giverId: "a", receiverId: "zzz" }])).toThrow();
  });

  test("impossible restrictions throw instead of looping forever", () => {
    expect(() => derangement(2, undefined, () => true)).toThrow();
  });

  test("buildDrawWithChat honours restrictions in what each giver opens", async () => {
    const pairs = await Promise.all([0, 1, 2, 3, 4].map(() => generateKeyPair()));
    const ms = await Promise.all(
      pairs.map(async (kp, i) => ({ id: `id-${i}`, name: `P${i}`, publicKey: await exportPublicKey(kp.publicKey), wishes: wish(i) })),
    );
    const restrictions = [
      { giverId: "id-0", receiverId: "id-2" },
      { giverId: "id-1", receiverId: "id-2" },
    ];
    for (let r = 0; r < 15; r++) {
      const out = await buildDrawWithChat(ms, undefined, restrictions);
      for (const g of [0, 1]) {
        const row = out.results.find((x) => x.giverId === ms[g].id)!;
        const p = await openPayload<{ receiverName: string }>(row.sealed, pairs[g].privateKey);
        expect(p.receiverName).not.toBe("P2");
      }
    }
  });
});

const wish = (n: number): Wish[] => [1, 2, 3].map((i) => ({ title: `Regalo ${n}-${i}`, price: 1000 * i }));

describe("buildDraw", () => {
  test("every giver opens their payload and receivers form a valid derangement", async () => {
    const names = ["Ana", "Carlos", "Daniel", "Lucía", "Mariana", "Pedro"];
    const pairs = await Promise.all(names.map(() => generateKeyPair()));
    const members = await Promise.all(
      names.map(async (name, i) => ({
        id: `id-${i}`,
        name,
        publicKey: await exportPublicKey(pairs[i].publicKey),
        wishes: wish(i),
      })),
    );
    const out = await buildDraw(members);
    expect(out).toHaveLength(names.length);
    const received = new Set<string>();
    for (let i = 0; i < members.length; i++) {
      const row = out.find((o) => o.giverId === members[i].id)!;
      const p = await openPayload<{ receiverName: string; wishes: Wish[] }>(row.sealed, pairs[i].privateKey);
      expect(p.receiverName).not.toBe(members[i].name);
      const receiver = members.find((m) => m.name === p.receiverName)!;
      expect(p.wishes).toEqual(receiver.wishes);
      received.add(p.receiverName);
    }
    expect(received.size).toBe(names.length);
  });

  test("a maximum-length member (60-char name, 120-char titles, 500-char links, accents) still seals", async () => {
    const kp = await generateKeyPair();
    const pub = await exportPublicKey(kp.publicKey);
    const maxWish = { title: "ñ".repeat(120), price: 60000, link: "á".repeat(500) };
    const big = { id: "a", name: "é".repeat(60), publicKey: pub, wishes: [maxWish, maxWish, maxWish] };
    const other = { id: "b", name: "Otro", publicKey: pub, wishes: wish(1) };
    const out = await buildDraw([big, other]);
    expect(out).toHaveLength(2);
    const sealedLens = new Set(out.map((o) => o.sealed.length));
    expect(sealedLens.size).toBe(1);
    expect(PAD_SIZE).toBe(4096);
  });
});

describe("buildDrawWithChat", () => {
  async function setup(n: number) {
    const pairs = await Promise.all(Array.from({ length: n }, () => generateKeyPair()));
    const members = await Promise.all(
      pairs.map(async (kp, i) => ({ id: `id-${i}`, name: `P${i}`, publicKey: await exportPublicKey(kp.publicKey), wishes: wish(i) })),
    );
    return { pairs, members, out: await buildDrawWithChat(members) };
  }
  type Thread = { id: string; key: string };

  test("the giver and the receiver of a pair open the same thread, and nobody else shares it", async () => {
    const { pairs, members, out } = await setup(6);
    const giverThread = new Map<string, Thread>();
    for (let i = 0; i < members.length; i++) {
      const r = out.results.find((x) => x.giverId === members[i].id)!;
      const p = await openPayload<{ receiverName: string; thread: Thread }>(r.sealed, pairs[i].privateKey);
      giverThread.set(p.receiverName, p.thread);
    }
    for (let i = 0; i < members.length; i++) {
      const inbox = out.inbox.find((x) => x.userId === members[i].id)!;
      const p = await openPayload<{ thread: Thread }>(inbox.sealed, pairs[i].privateKey);
      expect(p.thread).toEqual(giverThread.get(members[i].name));
    }
    expect(new Set([...giverThread.values()].map((t) => t.id)).size).toBe(members.length);
  });

  test("the inbox record does not say who the giver is", async () => {
    const { pairs, members, out } = await setup(4);
    const p = await openPayload<Record<string, unknown>>(out.inbox[0].sealed, pairs[members.findIndex((m) => m.id === out.inbox[0].userId)].privateKey);
    expect(Object.keys(p)).toEqual(["thread"]);
  });

  test("results, inbox records and thread hashes: one per person, all results and inbox records the same length", async () => {
    const { members, out } = await setup(5);
    expect(out.results).toHaveLength(5);
    expect(out.inbox).toHaveLength(5);
    expect(out.threads).toHaveLength(5);
    expect(new Set([...out.results, ...out.inbox].map((o) => o.sealed.length)).size).toBe(1);
    expect(new Set(out.inbox.map((o) => o.userId))).toEqual(new Set(members.map((m) => m.id)));
    for (const h of out.threads) expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the order of inbox records and thread hashes carries no information about who is paired with whom", async () => {
    const { members, out } = await setup(8);
    // results[i] is the giver members[i]; if inbox[i] were that giver's receiver, zipping the two would reveal the whole pairing.
    expect(out.inbox.map((r) => r.userId)).toEqual(members.map((m) => m.id).sort());
    expect(out.threads).toEqual([...out.threads].sort());
  });

  test("buildDraw still returns only the results", async () => {
    const { members } = await setup(3);
    const out = await buildDraw(members);
    expect(out).toHaveLength(3);
    expect(Object.keys(out[0]).sort()).toEqual(["giverId", "sealed"]);
  });
});
