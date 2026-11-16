import { importPublicKey } from "./crypto/keys";
import { sealPayload } from "./crypto/hybrid";

export type Wish = { title: string; price: number; link?: string };
export type DrawMember = { id: string; name: string; publicKey: string; wishes: Wish[] };

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max; // reject to avoid modulo bias
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

/** Random permutation p of 0..n-1 with p[i] !== i for every i (rejection sampling over Fisher–Yates). */
export function derangement(n: number, rng: (max: number) => number = randomInt): number[] {
  if (n < 2) throw new Error("A draw needs at least 2 people");
  for (;;) {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = rng(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    if (p.every((v, i) => v !== i)) return p;
  }
}

/** For each giver, seal `{receiverName, wishes}` (receiver's snapshot) with the giver's public key. */
export async function buildDraw(
  members: DrawMember[],
  rng?: (max: number) => number,
): Promise<{ giverId: string; sealed: string }[]> {
  const p = derangement(members.length, rng);
  return Promise.all(
    members.map(async (giver, i) => {
      const receiver = members[p[i]];
      const pub = await importPublicKey(giver.publicKey);
      const sealed = await sealPayload({ receiverName: receiver.name, wishes: receiver.wishes }, pub);
      return { giverId: giver.id, sealed };
    }),
  );
}
