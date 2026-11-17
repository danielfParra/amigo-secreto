import { describe, test, expect } from "vitest";
import { newThread, sealMessage, openMessage, threadHash, MESSAGE_MAX_CHARS, MessageTooLongError } from "./chat";

describe("chat crypto", () => {
  test("a new thread has a 32-hex id and a key, and each call is different", async () => {
    const a = newThread();
    const b = newThread();
    expect(a.id).toMatch(/^[0-9a-f]{32}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.id).not.toBe(b.id);
  });

  test("a message round-trips with its role and text", async () => {
    const t = newThread();
    const sealed = await sealMessage(t.key, "g", "Hola, ¿te gusta el chocolate?");
    const open = await openMessage(t.key, sealed);
    expect(open.role).toBe("g");
    expect(open.text).toBe("Hola, ¿te gusta el chocolate?");
  });

  test("short and long messages seal to ciphertexts of exactly the same length", async () => {
    const t = newThread();
    const short = await sealMessage(t.key, "r", "Sí");
    const long = await sealMessage(t.key, "r", "ñ".repeat(MESSAGE_MAX_CHARS));
    expect(short.length).toBe(long.length);
  });

  test("a message with the wrong key cannot be opened", async () => {
    const sealed = await sealMessage(newThread().key, "g", "secreto");
    await expect(openMessage(newThread().key, sealed)).rejects.toThrow();
  });

  test("the sealed text never contains the plaintext", async () => {
    const t = newThread();
    const sealed = await sealMessage(t.key, "g", "palabra-muy-reconocible");
    expect(sealed).not.toContain("palabra-muy-reconocible");
  });

  test("over the character cap, or empty, is refused", async () => {
    const t = newThread();
    await expect(sealMessage(t.key, "g", "a".repeat(MESSAGE_MAX_CHARS + 1))).rejects.toBeInstanceOf(MessageTooLongError);
    await expect(sealMessage(t.key, "g", "   ")).rejects.toThrow();
  });

  test("four-byte characters at the cap still fit", async () => {
    const t = newThread();
    const sealed = await sealMessage(t.key, "g", "🎄".repeat(MESSAGE_MAX_CHARS / 2));
    expect((await openMessage(t.key, sealed)).text).toBe("🎄".repeat(MESSAGE_MAX_CHARS / 2));
  });

  test("the thread hash is a stable 64-hex digest that does not contain the id", async () => {
    const t = newThread();
    const h = await threadHash(t.id);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await threadHash(t.id)).toBe(h);
    expect(h).not.toContain(t.id);
  });
});
