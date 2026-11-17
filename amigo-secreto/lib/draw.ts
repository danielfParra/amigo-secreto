import { importPublicKey } from "./crypto/keys";
import { sealPayload } from "./crypto/hybrid";
import { newThread, threadHash } from "./crypto/chat";

export type Wish = { title: string; price: number; link?: string; details?: string };
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

export type DrawOutput = {
  /** One per giver: who they give to, plus the key of their chat with that person. */
  results: { giverId: string; sealed: string }[];
  /** One per receiver: only the key of their chat with whoever gives to them (never who that is). */
  inbox: { userId: string; sealed: string }[];
  /** SHA-256 of each thread id, so the server can recognise a thread without being able to open it. */
  threads: string[];
};

/** Makes the pairing and seals everything for it, all in the caller's browser. */
export async function buildDrawWithChat(members: DrawMember[], rng?: (max: number) => number): Promise<DrawOutput> {
  const p = derangement(members.length, rng);
  const pairs = await Promise.all(
    members.map(async (giver, i) => {
      const receiver = members[p[i]];
      const thread = newThread();
      const [giverKey, receiverKey] = await Promise.all([importPublicKey(giver.publicKey), importPublicKey(receiver.publicKey)]);
      return {
        result: { giverId: giver.id, sealed: await sealPayload({ receiverName: receiver.name, wishes: receiver.wishes, thread }, giverKey) },
        inboxRow: { userId: receiver.id, sealed: await sealPayload({ thread }, receiverKey) },
        hash: await threadHash(thread.id),
      };
    }),
  );
  // Order must carry no information: results follow the giver list, so inbox records and thread hashes are sorted by
  // value. Otherwise zipping results[i] with inbox[i] (or reading insertion order in the database) would give the pairing.
  return {
    results: pairs.map((x) => x.result),
    inbox: pairs.map((x) => x.inboxRow).sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)),
    threads: pairs.map((x) => x.hash).sort(),
  };
}

/** Just the giver results (kept for callers that do not need chat). */
export async function buildDraw(
  members: DrawMember[],
  rng?: (max: number) => number,
): Promise<{ giverId: string; sealed: string }[]> {
  return (await buildDrawWithChat(members, rng)).results;
}
