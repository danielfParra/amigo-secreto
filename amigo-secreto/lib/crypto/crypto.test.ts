import { describe, test, expect } from "vitest";
import { newSalt, deriveSecrets } from "./kdf";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  wrapPrivateKey,
  unwrapPrivateKey,
} from "./keys";
import { sealPayload, openPayload, PAD_SIZE, PayloadTooLargeError } from "./hybrid";
import { toB64, fromB64 } from "./encoding";

const IT = 1000;

describe("encoding", () => {
  test("b64 round-trips bytes", () => {
    const b = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(fromB64(toB64(b)))).toEqual(Array.from(b));
  });
});

describe("kdf", () => {
  test("same pin and salt give the same authSecret", async () => {
    const salt = newSalt();
    const a = await deriveSecrets("1234", salt, IT);
    const b = await deriveSecrets("1234", salt, IT);
    expect(a.authSecret).toBe(b.authSecret);
  });

  test("different pin gives a different authSecret", async () => {
    const salt = newSalt();
    const a = await deriveSecrets("1234", salt, IT);
    const b = await deriveSecrets("1235", salt, IT);
    expect(a.authSecret).not.toBe(b.authSecret);
  });

  test("wrapKey is not extractable", async () => {
    const { wrapKey } = await deriveSecrets("1234", newSalt(), IT);
    expect(wrapKey.extractable).toBe(false);
  });
});

describe("keys", () => {
  test("wrap then unwrap round-trips a private key", async () => {
    const salt = newSalt();
    const { wrapKey } = await deriveSecrets("1234", salt, IT);
    const kp = await generateKeyPair();
    const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, wrapKey);
    const priv = await unwrapPrivateKey(wrapped, iv, wrapKey);
    const pub = await importPublicKey(await exportPublicKey(kp.publicKey));
    const sealed = await sealPayload({ hi: "there" }, pub);
    expect(await openPayload<{ hi: string }>(sealed, priv)).toEqual({ hi: "there" });
  });

  test("unwrapping with a wrong pin rejects", async () => {
    const salt = newSalt();
    const good = await deriveSecrets("1234", salt, IT);
    const bad = await deriveSecrets("9999", salt, IT);
    const kp = await generateKeyPair();
    const { wrapped, iv } = await wrapPrivateKey(kp.privateKey, good.wrapKey);
    await expect(unwrapPrivateKey(wrapped, iv, bad.wrapKey)).rejects.toBeDefined();
  });
});

describe("hybrid", () => {
  test("round-trips a receiver payload", async () => {
    const kp = await generateKeyPair();
    const payload = {
      receiverName: "Mariana",
      wishes: [{ title: "Taza térmica", price: 42000, link: "https://x.co/a" }],
    };
    const sealed = await sealPayload(payload, kp.publicKey);
    expect(await openPayload(sealed, kp.privateKey)).toEqual(payload);
  });

  test("sealed strings for a tiny and a large payload have identical length", async () => {
    const kp = await generateKeyPair();
    const small = await sealPayload({ a: "x".repeat(10) }, kp.publicKey);
    const large = await sealPayload({ a: "x".repeat(3000) }, kp.publicKey);
    expect(small.length).toBe(large.length);
  });

  test("opening with another user's private key rejects", async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    const sealed = await sealPayload({ secret: 1 }, a.publicKey);
    await expect(openPayload(sealed, b.privateKey)).rejects.toBeDefined();
  });

  test("payload over the limit throws PayloadTooLargeError", async () => {
    const kp = await generateKeyPair();
    await expect(
      sealPayload({ a: "x".repeat(PAD_SIZE) }, kp.publicKey),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  test("a payload exactly at the limit seals", async () => {
    const kp = await generateKeyPair();
    const overhead = JSON.stringify({ a: "" }).length;
    const payload = { a: "x".repeat(PAD_SIZE - 4 - overhead) };
    expect(JSON.stringify(payload).length).toBe(PAD_SIZE - 4);
    const sealed = await sealPayload(payload, kp.publicKey);
    expect(await openPayload(sealed, kp.privateKey)).toEqual(payload);
  });
});
