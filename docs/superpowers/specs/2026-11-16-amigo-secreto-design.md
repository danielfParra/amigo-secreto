# Amigo secreto — design

Date: 2026-11-16 · Status: awaiting approval

## Intent
A Spanish-language installable web app (PWA, iOS + Android via "Add to Home Screen") for one family's Christmas secret Santa (~12 people). Each person joins, lists three wishes (max $60.000 COP each), the organizer runs the draw, and each person privately sees who they give to. Nobody — server, database holder, or organizer — can read the pairings. Sketch: the user's private design canvas (6 screens: Inicio, Unirse, Lista, Grupo, Sorteo, Privacidad).

## Goals
- Installable, mobile-first, matches the sketch layout (Public Sans instead of the sketch's Figtree, mascot Regalito) in the user-supplied Christmas palette: #A60B08 red, #5E0001 deep red, #1D2E19 deep green, #CFCABF sand, #76584C brown (replaces the sketch's cream/yellow/blue/pink).
- Pairings private by construction (end-to-end encryption), as promised on the Privacidad screen.
- Accounts protected by a password or 4-digit PIN, usable from any device.
- Free to run (Vercel Hobby + free-tier Postgres via Vercel Marketplace).

## Non-goals / anti-goals
- Not a product for other families; no billing, i18n, or admin tooling.
- Push notifications and sending emails (v1).
- Defending against a malicious host serving altered JavaScript, or offline cracking of a 4-digit PIN by someone with database access (accepted: family, low-stakes data).
- Anti-goal: any feature that lets the organizer or DB holder read pairings.

## Approaches considered
- **A. E2E encryption, password-wrapped key stored on server (chosen).** Works across devices and iOS Safari→Home Screen storage split. Weakness: short PIN is guessable offline by DB holder (accepted).
- B. Server draws and stores pairings — simplest, but breaks the privacy promise.
- C. Keys only on device, no password — loses results on phone change/reinstall.
Hosting: Vercel Hobby + Marketplace Postgres (free) over Railway (already paid, but extra usage cost).

## Design (decided by you)
- Approach A. Free hosting on Vercel. Password/PIN per person.

## Design (my calls — please check)
- **Stack:** Next.js (App Router, TypeScript), PWA manifest + service worker, Postgres (Neon via Vercel Marketplace), WebCrypto in the browser.
- **Roster instead of email (user's change, supersedes the email-based join/login):** there are no emails anywhere. The organizer creates the group by pasting the list of family names (one per line) and picking which name is theirs. Names are shown in Spanish alphabetical order everywhere. The group size is simply the roster size (no separate "expected size"). Each roster row starts *unclaimed* (no credentials).
  - **Claim (join):** on the invite link (`/unirse?c=CODE`) a person picks their name from the unclaimed names and chooses a PIN; the browser makes their key pair and the server fills in that row, only if it is still unclaimed (atomic). A claimed name cannot be claimed again; they sign in instead.
  - **Sign-in:** pick your name from the list of claimed names (public, names only, for the one family group) and enter your PIN. Identity is the member id, never an email.
  - **PIN reset / lockout / draw gate** work as before but keyed by member id; the draw also needs every roster name claimed.
  - **Organizer** can add a person to the roster, remove a person (deletes their account and wishes, reopens the draw), reset a PIN, and redo the draw. A wrongly claimed name is fixed by removing and re-adding it.
  - **Accepted trade-off:** whoever has the invite link can claim an unclaimed name, so the link should only go to the family (WhatsApp group).
  - The app serves one family group: the sign-in name list is that of the most recently created group.
- **Keys:** at join, the browser creates an RSA-OAEP (2048, SHA-256) key pair. The private key is encrypted (AES-GCM) with a key derived from the PIN/password (PBKDF2, high iteration count) and stored on the server with the public key.
- **Login:** the browser derives a separate auth secret from the PIN/password (different salt/purpose); the server stores only a hash of it, never the PIN. Failed attempts are rate-limited: 5 wrong tries lock that account for 15 minutes (temporary, so a relative who knows someone's email can't lock them out for good). Session in an httpOnly cookie.
- **Who can fetch what:** salt and KDF parameters are public. The wrapped private key and a person's draw ciphertext are returned only to a session that passed the server-side, rate-limited check. This keeps relatives from trying all 10,000 PINs offline; only the database holder could (accepted).
- **Wishes:** stored in plaintext (not secret); editable until the draw, then locked. Max price validated against the group cap, with the friendly "se pasa del tope" error from the sketch.
- **Draw:** runs in the organizer's browser: random derangement (no one draws themselves). For each giver it builds `{receiverName, receiverWishes snapshot}`, pads it to a fixed size (e.g. 4 KB) so ciphertext length can't be matched to a person's wishes, encrypts it with a fresh AES-GCM key, and wraps that key with the giver's RSA-OAEP public key (hybrid encryption; RSA alone is too small for the payload). The server stores only these ciphertexts plus a "draw done" flag. The snapshot means the server never learns who looked up whose wishes.
- **Draw gate:** the organizer sets the expected group size (e.g. 12) when creating the group. The draw unlocks only when that many have joined and every list is complete; the Grupo screen shows "6 de 12".
- **Reveal:** the giver's browser decrypts with their unlocked private key; "Revelar/Ocultar" per the sketch.
- **Reset draw:** organizer can delete all results (with confirmation) to redo it, e.g. someone joined late.
- **Forgotten PIN (decided by the user, replaces the earlier "remove and rejoin" idea):** the organizer taps "Restablecer PIN" on a member (or the admin runs `scripts/reset-pin.ts <email>`, which also covers the organizer themselves). The next time that person signs in they are asked to choose a new PIN. The reset stays open for 3 days. Because the old PIN protected their private key and is unrecoverable, they get a new key pair; wishes are kept. If the draw was already done their result cannot be recovered, so the draw is reopened and re-run. Accepted trade-off (family app): anyone who knows the email could claim the account during the open window.
- **PIN length:** minimum 4 characters (user chose to keep 4 after being told the lockout allows about 480 guesses/day per account).
- **Honesty note:** the organizer's browser holds the pairings in memory during the draw but never stores or sends them in plaintext.
- **Tests:** crypto round-trip, derangement property test (no fixed points, everyone covered), auth/rate-limit, and an end-to-end smoke run of join → list → draw → reveal.
- **Visual polish:** port the sketch faithfully first, then a polish pass with the impeccable and emil-design-eng skills.

## Left to the builder
Exact PBKDF2/hash parameters, DB schema and table names, API route layout, service worker caching strategy, icon assets, error copy beyond the sketch.
