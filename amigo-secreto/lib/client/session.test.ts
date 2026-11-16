import { describe, test, expect, vi, afterEach } from "vitest";
import { createCredentials, loginSecrets, unlockPrivateKey } from "./session";
import { apiFetch } from "./api";
import { importPublicKey } from "@/lib/crypto/keys";
import { sealPayload, openPayload } from "@/lib/crypto/hybrid";

const IT = 1000;

describe("createCredentials / unlockPrivateKey", () => {
  test("the same PIN unlocks the private key that matches the published public key", async () => {
    const c = await createCredentials("1234", IT);
    const priv = await unlockPrivateKey("1234", { wrappedPrivateKey: c.wrappedPrivateKey, wrapIv: c.wrapIv }, c.salt, IT);
    const sealed = await sealPayload({ hola: "mundo" }, await importPublicKey(c.publicKey));
    expect(await openPayload(sealed, priv)).toEqual({ hola: "mundo" });
  });

  test("a wrong PIN fails to unlock", async () => {
    const c = await createCredentials("1234", IT);
    await expect(
      unlockPrivateKey("9999", { wrappedPrivateKey: c.wrappedPrivateKey, wrapIv: c.wrapIv }, c.salt, IT),
    ).rejects.toBeDefined();
  });

  test("the auth secret sent when choosing a PIN equals the one derived at sign-in", async () => {
    const c = await createCredentials("abcd-1", IT);
    const { authSecret } = await loginSecrets("abcd-1", c.salt, IT);
    expect(authSecret).toBe(c.authSecret);
  });

  test("returns exactly the key material the API expects, with no name or email", async () => {
    const c = await createCredentials("1234", IT);
    expect(Object.keys(c).sort()).toEqual(["authSecret", "publicKey", "salt", "wrapIv", "wrappedPrivateKey"]);
  });

  test("two calls never share a salt or key pair, even with the same PIN", async () => {
    const a = await createCredentials("same-pin", IT);
    const b = await createCredentials("same-pin", IT);
    expect(a.salt).not.toBe(b.salt);
    expect(a.publicKey).not.toBe(b.publicKey);
  });

  test("rejects a PIN shorter than 4 characters", async () => {
    await expect(createCredentials("12", IT)).rejects.toThrow();
  });
});

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("sends JSON with credentials and returns status and parsed data", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await apiFetch("/api/join", "POST", { a: 1 });
    expect(r).toEqual({ ok: true, status: 201, data: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/join");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.credentials).toBe("same-origin");
  });

  test("surfaces the server's Spanish error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Nombre o PIN incorrectos" }), { status: 401 })));
    const r = await apiFetch("/api/login", "POST", {});
    expect(r).toMatchObject({ ok: false, status: 401, error: "Nombre o PIN incorrectos" });
  });

  test("a network failure becomes a friendly error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const r = await apiFetch("/api/me", "GET");
    expect(r).toMatchObject({ ok: false, status: 0 });
    expect(r.ok === false && r.error).toMatch(/conexión/i);
  });
});
