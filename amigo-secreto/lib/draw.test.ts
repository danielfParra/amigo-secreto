import { describe, test, expect } from "vitest";
import { derangement, buildDraw, type Wish } from "./draw";
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
