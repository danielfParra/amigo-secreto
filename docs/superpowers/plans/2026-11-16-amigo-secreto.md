# Amigo secreto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an installable Spanish-language PWA for a ~12-person family secret Santa where pairings are end-to-end encrypted.

**Architecture:** Next.js App Router app (UI + route handlers) on Vercel, Postgres via `@neondatabase/serverless`. All cryptography runs in the browser with WebCrypto (`lib/crypto/*`); the server stores public keys, a password-wrapped private key, and padded hybrid-encrypted draw results, and never sees the PIN or any pairing.

**Tech Stack:** Next.js (App Router, TypeScript), Vitest, `@neondatabase/serverless`, WebCrypto, Node `crypto.scrypt` (server auth hash), `sharp` (dev, icon generation).

**Spec:** `docs/superpowers/specs/2026-11-16-amigo-secreto-design.md`. Visual reference: the user's sketch (a private Claude design canvas with six screens: Inicio, Unirse, Lista, Grupo, Sorteo, Privacidad).


> **Superseded in part (2026-11-16, user request): roster instead of email.** The email-based identity described in Tasks 4–6 and 9–10 below no longer exists. The spec's *Roster instead of email* section and this summary are authoritative; the code and tests follow them.
>
> - Tables: `groups(id, name, event_date, price_cap, invite_code, organizer_id, draw_done)` (single group via a unique index) and `users(id, group_id, name, salt, auth_hash, public_key, wrapped_private_key, wrap_iv, failed_attempts, locked_until, pin_reset_until)`. A row is *claimed* when `auth_hash IS NOT NULL`; unique `(group_id, lower(name))`. No email, no expected size.
> - `POST /api/groups` `{groupName, eventDate?, priceCap, names[], me, salt, authSecret, publicKey, wrappedPrivateKey, wrapIv}` → 201 `{inviteCode}` (409 if a group exists; the organizer row is claimed in the same statement). `GET /api/groups/[code]` → names with claimed flags. `GET /api/roster` → claimed names for sign-in.
> - `POST /api/join` `{inviteCode, memberId, ...credentials}` claims a name atomically (409 if taken). `GET /api/salt?memberId=`, `POST /api/login` `{memberId, authSecret}`, `POST /api/pin-reset` `{memberId, ...credentials}`.
> - `POST /api/members` `{name}` adds a person (reopens a finished draw); `DELETE /api/members/[id]`; `POST /api/members/[id]/reset-pin`. `GET /api/group` → `{members:[{id,name,claimed,ready,resetPending}], size, readyCount, drawDone, canDraw}` with `canDraw` needing every name claimed, every list complete and no open reset. `PATCH /api/groups` was removed.
> - Client: `createCredentials(pin)` (no name or email), `loginSecrets`, `unlockPrivateKey`. Names are sorted with `Intl.Collator('es')` (`lib/names.ts`).

## Global Constraints

- All UI copy in Spanish; money is COP, default cap `$60.000`, formatted with `.` thousands separators.
- App root is `amigo-secreto/` inside the project folder; docs stay at the project root.
- Key pair: RSA-OAEP, 2048-bit, SHA-256. Private key wrapped with AES-GCM; wrap key from PBKDF2 (SHA-256) of the PIN/password.
- Draw payload: `{receiverName, wishes[]}` padded to exactly 4096 bytes, encrypted with a fresh AES-GCM key, which is wrapped with the giver's RSA-OAEP public key.
- PIN/password: minimum 4 characters. 5 wrong logins lock the account for 15 minutes (temporary).
- Wishes: exactly 3, each needs title and price (integer COP ≤ group cap); link optional. Editable until draw is done.
- Draw unlocks only when joined members == expected size and all lists complete. Self-pairing impossible. Draw is organizer-only; organizer may reset it.
- Server never receives the PIN, any plaintext pairing, or a request revealing who looked up whose wishes.
- Session: random token in `sessions` table, httpOnly + Secure + SameSite=Lax cookie, 30 days.
- Typography: Public Sans (replaces the sketch's Figtree). Palette supplied by the user (supersedes the sketch colors): red `#A60B08`, deep red `#5E0001`, deep green `#1D2E19` (ink), sand `#CFCABF` (page background), brown `#76584C` (only behind white text; small text uses darker `#5A4238`), plus derived card `#EFECE5` and line `#B9B3A5`; 44px minimum touch targets; respect `prefers-reduced-motion`.
- No emails are sent; email is only a login identifier (unique per group).

## Review Focus

1. Duplicate email (case-insensitive) anywhere in the app → rejected (409), not silently overwritten.
2. Joining after the draw is done → rejected (409); a late joiner requires reset-draw first.
3. Price input variants (`$48.000`, `48000`, `48.000`, `abc`, `-5`, `0`) → parsed or rejected with the friendly message; never NaN.
4. Draw with 2 members → valid swap; fewer than 2 → refused; draw payload for any number of wishes/long titles still pads to 4096 or is rejected with a clear error (never truncated silently).
5. Correct PIN during an active lockout → still refused; lockout expires after 15 minutes; logged-out or expired session on any protected route → 401.
6. Someone joins in Safari, then opens the installed Home Screen app (no shared cookies): they land on Inicio and can reach "Ya tengo cuenta" → `/entrar` and log in with email + PIN alone (no invite code).
7. A member with very long wishes/links/accents still seals within 4096 bytes; the draw never fails at the last step because of length.
8. Someone drops out: organizer lowers `expectedSize` (or removes the member) and the draw can proceed.

---

### Task 1: Scaffold, tooling, git

**Files:**
- Create: `amigo-secreto/` (Next.js app), `amigo-secreto/vitest.config.ts`, `amigo-secreto/.env.example`, `.gitignore`
- Modify: `amigo-secreto/package.json` (scripts: `test`, `test:watch`)

**Interfaces:**
- Produces: working `npm test` and `npm run dev` in `amigo-secreto/`; git repo at project root.

- [ ] **Step 1:** `git init` at project root; scaffold with `npx create-next-app@latest amigo-secreto --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --yes`. The project lives in Dropbox: mark `node_modules` and `.next` as ignored by Dropbox (PowerShell: `Set-Content -Path <folder> -Stream com.dropbox.ignored -Value 1`) to avoid EPERM/EBUSY errors.
- [ ] **Step 2:** Add dev deps `vitest`, `sharp`, `tsx`; deps `@neondatabase/serverless`. Add `vitest.config.ts` (environment `node`, alias `@` → project root, `loadEnv` from `vite` to load `.env.local` into `process.env`) and `.env.example` with `DATABASE_URL=`, `DATABASE_URL_TEST=`, `SALT_SECRET=`. Test helper `tests/db-guard.ts` throws if `DATABASE_URL_TEST` is missing or equals `DATABASE_URL`; every DB test imports it and uses only `DATABASE_URL_TEST` (tests TRUNCATE tables).
- [ ] **Commit rule:** every commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- [ ] **Step 3:** Add a trivial test `lib/sanity.test.ts` asserting `globalThis.crypto.subtle` is defined; run `npm test` → PASS; delete the sanity test.
- [ ] **Step 4:** Commit `chore: scaffold next app with vitest`.

### Task 1b: Provision databases with the Vercel MCP

- [ ] **Step 1:** Authenticate the Vercel MCP (`mcp__plugin_vercel_vercel__authenticate`, then `complete_authentication`). **Ask the user before creating any project or resource.**
- [ ] **Step 2:** Create/link project `amigo-secreto` on the Hobby team. Provision a free-tier Postgres from the Vercel Marketplace (MCP if supported, otherwise dashboard); confirm it is free **before accepting**. Create a second, separate database/branch for tests. Put `DATABASE_URL`, `DATABASE_URL_TEST`, `SALT_SECRET` (random 32 bytes) in `amigo-secreto/.env.local` (git-ignored) and `DATABASE_URL`/`SALT_SECRET` in Vercel env. Never commit secrets.
- [ ] **Step 3:** Verify with a one-line script that both URLs connect and are different. No commit needed.

### Task 2: Crypto core (TDD)

**Files:**
- Create: `amigo-secreto/lib/crypto/kdf.ts`, `keys.ts`, `hybrid.ts`, `encoding.ts`
- Test: `amigo-secreto/lib/crypto/crypto.test.ts`

**Interfaces:**
- Produces (all browser/Node-safe, WebCrypto only):
  - `encoding.ts`: `toB64(bytes: Uint8Array): string`, `fromB64(s: string): Uint8Array`
  - `kdf.ts`: `newSalt(): string` (16 random bytes, b64); `deriveSecrets(pin: string, saltB64: string, iterations?: number): Promise<{ authSecret: string; wrapKey: CryptoKey }>` — one PBKDF2-SHA256 derivation of 32 bytes (default 600_000 iterations), then HKDF-SHA256 with info `"wrap"` → AES-GCM `wrapKey` (non-extractable) and info `"auth"` → 32-byte `authSecret` (b64).
  - `keys.ts`: `generateKeyPair(): Promise<CryptoKeyPair>`; `exportPublicKey(k: CryptoKey): Promise<string>` (JWK JSON string); `importPublicKey(s: string): Promise<CryptoKey>`; `wrapPrivateKey(priv: CryptoKey, wrapKey: CryptoKey): Promise<{ wrapped: string; iv: string }>`; `unwrapPrivateKey(wrapped: string, iv: string, wrapKey: CryptoKey): Promise<CryptoKey>`
  - `hybrid.ts`: `PAD_SIZE = 4096`; `sealPayload(payload: object, pub: CryptoKey): Promise<string>`; `openPayload<T>(sealed: string, priv: CryptoKey): Promise<T>`; throws `PayloadTooLargeError` if JSON > `PAD_SIZE - 4` bytes.

- [ ] **Step 1: Write failing tests** in `crypto.test.ts` (use `iterations = 1000` in tests): `deriveSecrets same pin+salt → same authSecret`; `different pin → different authSecret`; `wrapKey is not extractable`; `wrap/unwrap private key round-trips and wrong pin fails (rejects)`; `sealPayload/openPayload round-trips {receiverName:'Mariana', wishes:[…]}`; `sealed strings for a 10-byte and a 3000-byte payload have identical length`; `opening with another user's private key rejects`; `payload over limit throws PayloadTooLargeError`.
- [ ] **Step 2:** Run `npm test -- crypto` → FAIL (modules missing).
- [ ] **Step 3:** Implement. Padding: 4-byte big-endian length prefix + JSON bytes + zero fill to 4096. Sealed format: JSON `{k, iv, ct}` (all b64) encoded as a string; `k` = RSA-OAEP-wrapped raw AES key.
- [ ] **Step 4:** Run `npm test -- crypto` → PASS.
- [ ] **Step 5:** Commit `feat: browser crypto core`.

### Task 3: Draw logic (TDD)

**Files:**
- Create: `amigo-secreto/lib/draw.ts`
- Test: `amigo-secreto/lib/draw.test.ts`

**Interfaces:**
- Produces: `derangement(n: number, rng?: () => number): number[]` — permutation `p` with `p[i] !== i` for all i; throws if `n < 2`. `buildDraw(members: {id: string; name: string; publicKey: string; wishes: Wish[]}[], rng?): Promise<{giverId: string; sealed: string}[]>` where `Wish = {title: string; price: number; link?: string}`; each payload is `{receiverName, wishes}` for the receiver, sealed with `sealPayload` for the giver.

- [ ] **Step 1: Write failing tests:** `derangement has no fixed points for n=2..50 over 200 runs each`; `derangement is a permutation (each index exactly once)`; `n=2 always swaps`; `n<2 throws`; `buildDraw: every giver can open their sealed payload and receiverName maps back to a valid derangement` (real keys from Task 2, 6 members).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `derangement` with rejection sampling over Fisher–Yates; `buildDraw` uses it. **Step 4:** Run → PASS. **Step 5:** Commit `feat: draw logic`.

### Task 4: Database layer and money parsing (TDD where pure)

**Files:**
- Create: `amigo-secreto/db/schema.sql`, `amigo-secreto/lib/db.ts`, `amigo-secreto/lib/cop.ts`, `amigo-secreto/scripts/migrate.ts`
- Test: `amigo-secreto/lib/cop.test.ts`

**Interfaces:**
- Produces: `sql` (tagged template from `neon(process.env.DATABASE_URL)`); `parseCop(input: string): number | null` (accepts `$48.000`, `48.000`, `48000`; returns null for empty, non-numeric, ≤ 0); `formatCop(n: number): string` → `"$48.000"`.
- Tables in `schema.sql`: `groups(id uuid pk, name, event_date date, price_cap int, expected_size int, invite_code text unique, organizer_id uuid, draw_done bool default false)`; `users(id uuid pk, group_id fk, name, email (stored lowercase), salt, auth_hash, public_key, wrapped_private_key, wrap_iv, failed_attempts int default 0, locked_until timestamptz, unique(email))` — email is unique across the whole app (one family), so login needs no invite code; `wishes(user_id fk, position int check 1..3, title, price int, link, pk(user_id, position))`; `results(giver_id uuid pk fk users, sealed text)`; `sessions(token text pk, user_id fk, expires_at timestamptz)`.

- [ ] **Step 1: Write failing `cop.test.ts`** covering the five inputs from Review Focus 3 plus `formatCop(60000) === "$60.000"`. **Step 2:** run → FAIL. **Step 3:** implement `cop.ts`. **Step 4:** run → PASS.
- [ ] **Step 5:** Write `schema.sql` and `scripts/migrate.ts` (executes the file against the URL in env var named by argv, e.g. `tsx scripts/migrate.ts DATABASE_URL_TEST`); run it against the test database and the main database from Task 1b.
- [ ] **Step 6:** Commit `feat: schema, db client, cop parsing`.

### Task 5: Auth and group API

**Files:**
- Create: `amigo-secreto/lib/server/auth.ts`, `lib/server/session.ts`, `app/api/groups/route.ts`, `app/api/groups/[code]/route.ts`, `app/api/join/route.ts`, `app/api/salt/route.ts`, `app/api/login/route.ts`, `app/api/logout/route.ts`, `app/api/me/route.ts`
- Test: `amigo-secreto/app/api/auth.test.ts` (calls route handlers directly; needs `DATABASE_URL` test DB; truncate tables in `beforeEach`)

**Interfaces:**
- Consumes: `sql`, crypto modules (client-side values arrive as request fields).
- Produces (JSON):
  - `POST /api/groups` `{groupName, eventDate, priceCap, expectedSize, name, email, salt, authSecret, publicKey, wrappedPrivateKey, wrapIv}` → `{inviteCode}`; creates group + organizer user + session cookie.
  - `GET /api/groups/[code]` → `{name, eventDate, priceCap}` (public).
  - `POST /api/join` `{inviteCode, name, email, salt, authSecret, publicKey, wrappedPrivateKey, wrapIv}` → 201 + session cookie; 409 on duplicate email or `draw_done`; 409 if group already at `expected_size`.
  - `GET /api/salt?email=` → `{salt}` (public; unknown email returns a deterministic fake salt derived from `HMAC(SALT_SECRET, email)`).
  - `PATCH /api/groups` `{expectedSize}` (organizer only, before draw, never below current member count; 422 otherwise) → 200.
  - `POST /api/login` `{email, authSecret}` → session cookie (login works with email + PIN only, so the installed iOS app, which does not share cookies with Safari, can sign in); 401 wrong; 423 while locked. Server stores `scrypt(authSecret, per-user random salt)`; compares with `timingSafeEqual`. 5th consecutive failure sets `locked_until = now()+15 min`; success resets the counter; correct secret while locked still → 423.
  - `POST /api/logout` clears session. `GET /api/me` (401 without valid session) → `{user:{id,name,email,isOrganizer}, group:{name,eventDate,priceCap,expectedSize,drawDone,inviteCode}, wrappedPrivateKey, wrapIv, wishes[]}`.
  - `requireSession(req): Promise<{userId, groupId}>` in `lib/server/session.ts` (throws a 401 `Response`).

- Implementation notes: read the session from `req.cookies` and set it on the returned `NextResponse` (not `next/headers`), so handlers can be called directly in tests. In dynamic routes `params` is a Promise (`{ params }: { params: Promise<{ code: string }> }`); tests pass `Promise.resolve({...})`.

- [ ] **Step 1: Write failing tests:** `PATCH /api/groups` raises the size, rejects below member count and rejects a non-organizer; login with only email + PIN succeeds with no cookie from a prior session; create-group then `/api/me` as organizer; join success; duplicate email 409; join at capacity 409; login success; 4 wrong then correct succeeds (counter reset); 5 wrong → 423 even with correct secret; lockout released when `locked_until` set to the past; `/api/me` without cookie 401; expired session 401; unknown-email salt is stable across calls.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS. **Step 5:** Commit `feat: auth and group api`.

### Task 6: Wishes, status, draw API

**Files:**
- Create: `app/api/wishes/route.ts`, `app/api/group/route.ts`, `app/api/draw/route.ts`, `app/api/draw/inputs/route.ts`, `app/api/result/route.ts`, `app/api/members/[id]/route.ts`
- Test: `app/api/draw.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `parseCop`.
- Produces:
  - `PUT /api/wishes` `{wishes: [{title, price: string, link?}]×3}` → 200; 422 `{error, field}` for bad/over-cap price, empty title, title > 120 chars or link > 500 chars; 409 if `drawDone`. Member names are capped at 60 chars at join/create. Worst-case payload JSON (60 + 3×(120+500+small)) fits the 4092-byte limit.
  - `GET /api/group` → `{members:[{id,name,ready}], expectedSize, readyCount, drawDone, canDraw}` (no keys, no wishes).
  - `GET /api/draw/inputs` (organizer only; 409 unless `canDraw`) → `[{id,name,publicKey,wishes[]}]`.
  - `POST /api/draw` `{results:[{giverId, sealed}]}` (organizer only) → 200; 409 if already done or `!canDraw`; 422 unless `results` covers every member exactly once.
  - `DELETE /api/draw` (organizer) → clears `results`, `draw_done=false`.
  - `GET /api/result` → `{sealed}` for the caller only; 404 before the draw.
  - `DELETE /api/members/[id]` (organizer, not self) → removes the member and resets any draw.

- [ ] **Step 1: Write failing tests** for: a maximum-length member (60-char name, three 120-char titles, three 500-char links, multi-byte accents) seals via `sealPayload` without error (add to `draw.test.ts` too); over-length title/link 422; over-cap price 422; third wish missing 422; `canDraw` false until expected size joined and all ready; non-organizer cannot call draw/inputs/delete (403); draw with a missing giver 422; draw twice 409; reset then redraw succeeds; `GET /api/result` returns only the caller's ciphertext; deleting a member resets `draw_done`; after draw, `PUT /api/wishes` 409; join after draw 409 (Review Focus 2).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS. **Step 5:** Commit `feat: wishes, status and draw api`.

### Task 7: End-to-end privacy test

**Files:**
- Test: `amigo-secreto/tests/e2e-privacy.test.ts`

**Interfaces:**
- Consumes: crypto lib, `buildDraw`, route handlers from Tasks 5–6, low PBKDF2 iterations.

- [ ] **Step 1: Write the test:** 5 users join (organizer creates, 4 join via invite), each saves 3 wishes, organizer fetches inputs → `buildDraw` → posts results. Assert: every user logs in with their PIN, unwraps their key, opens their `/api/result`, gets a receiver who is not themselves and whose set over all users is a permutation; all `results.sealed` strings have equal length; no `results` or other table row contains any member's name in plaintext as a receiver (grep serialized `results`); a wrong-user key cannot open someone else's sealed result.
- [ ] **Step 2:** Run → PASS (fix any real bug it finds; do not weaken assertions). **Step 3:** Commit `test: end-to-end privacy`.

### Task 8: UI foundation, Inicio and PWA

**Files:**
- Create: `app/layout.tsx` (Public Sans via `next/font`, `lang="es"`, theme-color, apple meta), `app/globals.css` (tokens from Global Constraints), `components/Regalito.tsx`, `components/Bubble.tsx`, `components/Button.tsx`, `components/ProgressBar.tsx`, `app/page.tsx` (Inicio), `app/manifest.ts`, `public/sw.js`, `components/RegisterSW.tsx`, `scripts/make-icons.ts`, `public/icons/*`
- Test: `components/components.test.tsx` is **not** required; verify visually.

**Interfaces:**
- Produces: `<Regalito color="rosado"|"azul"|"verde"|"amarillo" />` (animated per `Inicio.dc.html`: bob, blink, lid-hop; reduced-motion safe); `<Bubble tone="yellow"|"blue">`; `<Button variant="primary"|"ghost" href? onClick?>` (≥44px); `<ProgressBar value max />`. Manifest: name "Amigo secreto", `display: standalone`, `background_color #F5F3E8`, icons 192/512 + maskable + apple-touch-icon (180) generated by `make-icons.ts` (sharp) from the user's artwork `app_icon.jpeg` at the project root (a rounded-square icon on a cream border: crop to the inner artwork so no cream corners remain, since iOS/Android apply their own mask; maskable version keeps the gift inside the central 80%). `sw.js`: cache-first for static assets and the app shell, network-only for `/api/*`.

- [ ] **Step 1:** Port Inicio screen from `Inicio.dc.html` (headline "¿Quién te tocará este año?", two speech bubbles, "Empezar" → `/unirse`, "Ver otra vez" replays); add a secondary "Ya tengo cuenta" link → `/entrar`. **Step 2:** manifest, SW registration (production only), icons. **Step 3:** `npm run build` succeeds; run `npm run dev` and check `/` at 390px width and that `/manifest.webmanifest` is served. **Step 4:** Commit `feat: ui foundation, inicio, pwa shell`.

### Task 9: Join, create, login screens and client session

**Files:**
- Create: `lib/client/session.ts`, `lib/client/api.ts`, `app/unirse/page.tsx`, `app/crear/page.tsx`, `app/entrar/page.tsx`
- Test: `lib/client/session.test.ts`

**Interfaces:**
- Consumes: crypto lib, API from Task 5.
- Produces: `registerAccount(input: {pin: string; name: string; email: string}): Promise<{salt; authSecret; publicKey; wrappedPrivateKey; wrapIv}>`; `loginSecrets(pin: string, saltB64: string)`; `unlockPrivateKey(pin: string, me: {wrappedPrivateKey; wrapIv}, saltB64: string): Promise<CryptoKey>` (rejects on wrong PIN). Private key is never persisted; Sorteo asks for the PIN again.

- [ ] **Step 1: Failing test** `session.test.ts`: `registerAccount` output feeds `unlockPrivateKey` with the same PIN and fails with a wrong one (low iterations via injected param). **Step 2:** run → FAIL. **Step 3:** implement helpers. **Step 4:** run → PASS.
- [ ] **Step 5:** Build screens from `Main.dc.html`: `/unirse?c=CODE` (name, email, PIN ≥4 chars, "Unirme"; link "Crear un grupo nuevo" → `/crear`; shows group name + cap from `GET /api/groups/[code]`), `/crear` (group name, date, cap default 60000, expected size, plus the same account fields), `/entrar` (email + PIN only, no invite code; shows lockout message on 423); `/unirse` also has a "Ya tengo cuenta" link → `/entrar`; the `/grupo` screen lets the organizer edit the expected size via `PATCH /api/groups`. Friendly Spanish errors for 401/409/423.
- [ ] **Step 6:** Manual check on a dev DB: create group, join from a second browser profile, login/logout. **Step 7:** Commit `feat: join, create, login screens`.

### Task 10: Lista and Grupo screens

**Files:**
- Create: `app/lista/page.tsx`, `app/grupo/page.tsx`, `components/WishCard.tsx`, `components/InviteButton.tsx`

**Interfaces:**
- Consumes: `/api/me`, `/api/wishes`, `/api/group`, `/api/draw*`, `buildDraw`, `importPublicKey`.

- [ ] **Step 1:** Port `Lista.dc.html`: three wish cards, live over-cap error "Uy, se pasa del tope de $60.000" (use `parseCop` + cap from `/api/me`), optional link, "Guardar mi lista" → `PUT /api/wishes` then `/grupo`; read-only after draw.
- [ ] **Step 2:** Port `Grupo.dc.html`: group name, date and cap chips, progress "N de {expectedSize}", member rows (Lista/Pendiente), "Invitar" (Web Share API with copy-link fallback of `/unirse?c=CODE`), "Hacer el sorteo" (organizer only, disabled until `canDraw`; on click: `GET /api/draw/inputs` → `buildDraw` → `POST /api/draw`). After draw: button becomes "Ver mi amigo secreto" → `/privacidad`; organizer sees "Rehacer sorteo" (confirm dialog → `DELETE /api/draw`) and a per-member "Quitar" action (confirm → `DELETE /api/members/[id]`).
- [ ] **Step 3:** Manual check with 3 browser profiles through a full draw. **Step 4:** Commit `feat: lista and grupo screens`.

### Task 11: Privacidad and Sorteo screens

**Files:**
- Create: `app/privacidad/page.tsx`, `app/sorteo/page.tsx`

- [ ] **Step 1:** Port `Privacidad.dc.html` (four points, "Entendido" → `/sorteo`).
- [ ] **Step 2:** Port `Sorteo.dc.html`: hidden state with Regalito and "Revelar"; Revelar asks for the PIN (inline field), runs `unlockPrivateKey` → `GET /api/result` → `openPayload`, then shows receiver name and their three wishes with "Ver" links; "Ocultar" clears the decrypted data from state. Wrong PIN → friendly error; no result before draw → "El sorteo aún no se ha hecho".
- [ ] **Step 3:** Manual check: reveal on two accounts shows different receivers, neither self. **Step 4:** Commit `feat: privacidad and sorteo screens`.

### Task 12: Deploy to Vercel

**Files:**
- Create: `amigo-secreto/vercel.ts` only if config beyond defaults is needed (otherwise none).

- [ ] **Step 1:** Confirm the project, database and env vars from Task 1b exist (`DATABASE_URL`, `SALT_SECRET`). The test database is never used in production.
- [ ] **Step 2:** Deploy via the Vercel MCP (or `vercel deploy` if the CLI is installed; it is not installed today).
- [ ] **Step 3:** Confirm the production database has the schema (`migrate.ts DATABASE_URL`).
- [ ] **Step 4:** Check the deployment logs are clean; on a phone, open the URL, add to Home Screen (iOS Safari and Android Chrome), run the full flow with 2 real accounts, confirm the app opens standalone and login persists. Report the URL.
- [ ] **Step 5:** Commit `chore: deployment config`.

### Task 13: Design polish pass

- [ ] **Step 1:** Run the `impeccable` skill on the built screens (hierarchy, spacing, empty/error states, accessibility, responsive at 360–430px); run `emil-design-eng` for transitions (reveal pop, button press, page transitions) keeping reduced-motion support.
- [ ] **Step 2:** Re-run `npm test` and `npm run build` → all PASS. Redeploy. Commit `style: polish pass`.

---

## Self-review notes

- Spec coverage: PWA (T8), E2E keys + wrap (T2, T9), login/lockout/fetch rules (T5), wishes + cap (T6, T10), padded hybrid draw + gate + reset (T2, T3, T6, T10), forgotten PIN → remove member + rejoin (T6, T10), reveal with PIN re-entry (T11), free hosting (T12), polish (T13), tests incl. privacy (T7). Email sending is a non-goal and absent.
- Types: `Wish`, `buildDraw`, `sealPayload/openPayload`, `registerAccount/unlockPrivateKey` names are used identically in later tasks.
