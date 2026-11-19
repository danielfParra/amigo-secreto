import { describe, test, expect, vi, afterEach } from "vitest";
import {
  createCredentials,
  createCredentialsWithKey,
  loginSecrets,
  unlockAndRememberPrivateKey,
  unlockPrivateKey,
  unlockPrivateKeyFromDevice,
} from "./session";
import { clearDeviceWrapKey, saveDeviceWrapKey } from "./deviceKey";
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

  test("device wrapKey unlocks the private key without asking for the PIN again, and clears on logout", async () => {
    const { credentials, wrapKey } = await createCredentialsWithKey("1234", IT);
    await saveDeviceWrapKey("user-1", wrapKey);

    const priv = await unlockPrivateKeyFromDevice({
      user: { id: "user-1" },
      wrappedPrivateKey: credentials.wrappedPrivateKey,
      wrapIv: credentials.wrapIv,
    });
    expect(priv).not.toBeNull();
    const sealed = await sealPayload({ hola: "sin-pin" }, await importPublicKey(credentials.publicKey));
    expect(await openPayload(sealed, priv!)).toEqual({ hola: "sin-pin" });

    // A different user never gets user-1's key.
    expect(
      await unlockPrivateKeyFromDevice({
        user: { id: "user-2" },
        wrappedPrivateKey: credentials.wrappedPrivateKey,
        wrapIv: credentials.wrapIv,
      }),
    ).toBeNull();

    // After logout, the device key is gone.
    await clearDeviceWrapKey();
    expect(
      await unlockPrivateKeyFromDevice({
        user: { id: "user-1" },
        wrappedPrivateKey: credentials.wrappedPrivateKey,
        wrapIv: credentials.wrapIv,
      }),
    ).toBeNull();
  });

  test("unlockAndRememberPrivateKey unlocks once with PIN and saves the key for future PIN-free unlocks", async () => {
    await clearDeviceWrapKey();
    const c = await createCredentials("4321", IT);
    const me = { user: { id: "user-3" }, wrappedPrivateKey: c.wrappedPrivateKey, wrapIv: c.wrapIv, salt: c.salt };

    await unlockAndRememberPrivateKey("4321", me, IT);
    const priv = await unlockPrivateKeyFromDevice(me);
    expect(priv).not.toBeNull();
    const sealed = await sealPayload({ ok: true }, await importPublicKey(c.publicKey));
    expect(await openPayload(sealed, priv!)).toEqual({ ok: true });
    await clearDeviceWrapKey();
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
