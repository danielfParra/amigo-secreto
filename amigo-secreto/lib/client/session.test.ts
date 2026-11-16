import { describe, test, expect, vi, afterEach } from "vitest";
import { registerAccount, createCredentials, loginSecrets, unlockPrivateKey } from "./session";
import { apiFetch } from "./api";
import { importPublicKey } from "@/lib/crypto/keys";
import { sealPayload, openPayload } from "@/lib/crypto/hybrid";

const IT = 1000;

describe("registerAccount / unlockPrivateKey", () => {
  test("the same PIN unlocks the private key that matches the published public key", async () => {
    const acct = await registerAccount({ pin: "1234", name: "Ana", email: "ana@example.com" }, IT);
    const priv = await unlockPrivateKey("1234", { wrappedPrivateKey: acct.wrappedPrivateKey, wrapIv: acct.wrapIv }, acct.salt, IT);
    const sealed = await sealPayload({ hola: "mundo" }, await importPublicKey(acct.publicKey));
    expect(await openPayload(sealed, priv)).toEqual({ hola: "mundo" });
  });

  test("a wrong PIN fails to unlock", async () => {
    const acct = await registerAccount({ pin: "1234", name: "Ana", email: "ana@example.com" }, IT);
    await expect(
      unlockPrivateKey("9999", { wrappedPrivateKey: acct.wrappedPrivateKey, wrapIv: acct.wrapIv }, acct.salt, IT),
    ).rejects.toBeDefined();
  });

  test("the auth secret sent at registration equals the one derived at login", async () => {
    const acct = await registerAccount({ pin: "abcd-1", name: "Ana", email: "ana@example.com" }, IT);
    const { authSecret } = await loginSecrets("abcd-1", acct.salt, IT);
    expect(authSecret).toBe(acct.authSecret);
  });

  test("returns exactly the fields the API expects, including name and email", async () => {
    const acct = await registerAccount({ pin: "1234", name: "  Ana ", email: "Ana@Example.com" }, IT);
    expect(Object.keys(acct).sort()).toEqual(
      ["authSecret", "email", "name", "publicKey", "salt", "wrapIv", "wrappedPrivateKey"].sort(),
    );
    expect(acct.name).toBe("Ana");
    expect(acct.email).toBe("ana@example.com");
  });

  test("rejects a PIN shorter than 4 characters", async () => {
    await expect(registerAccount({ pin: "12", name: "Ana", email: "ana@example.com" }, IT)).rejects.toThrow();
  });
});

describe("createCredentials (new PIN after an organizer reset)", () => {
  test("returns fresh credentials without a name, usable with the new PIN only", async () => {
    const c = await createCredentials({ pin: "nuevo-pin-9", email: " Ana@Example.com " }, IT);
    expect(Object.keys(c).sort()).toEqual(["authSecret", "email", "publicKey", "salt", "wrapIv", "wrappedPrivateKey"].sort());
    expect(c.email).toBe("ana@example.com");
    const priv = await unlockPrivateKey("nuevo-pin-9", { wrappedPrivateKey: c.wrappedPrivateKey, wrapIv: c.wrapIv }, c.salt, IT);
    const sealed = await sealPayload({ x: 1 }, await importPublicKey(c.publicKey));
    expect(await openPayload(sealed, priv)).toEqual({ x: 1 });
    await expect(
      unlockPrivateKey("1234", { wrappedPrivateKey: c.wrappedPrivateKey, wrapIv: c.wrapIv }, c.salt, IT),
    ).rejects.toBeDefined();
  });

  test("two calls never share a salt or key pair", async () => {
    const a = await createCredentials({ pin: "same-pin", email: "a@example.com" }, IT);
    const b = await createCredentials({ pin: "same-pin", email: "a@example.com" }, IT);
    expect(a.salt).not.toBe(b.salt);
    expect(a.publicKey).not.toBe(b.publicKey);
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
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Correo o PIN incorrectos" }), { status: 401 })));
    const r = await apiFetch("/api/login", "POST", {});
    expect(r).toMatchObject({ ok: false, status: 401, error: "Correo o PIN incorrectos" });
  });

  test("a network failure becomes a friendly error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const r = await apiFetch("/api/me", "GET");
    expect(r).toMatchObject({ ok: false, status: 0 });
    expect(r.ok === false && r.error).toMatch(/conexión/i);
  });
});
