# Migrate from self-hosted Better Auth to Neon Auth

**Date:** 2026-06-14
**Status:** Approved (design)

## Goal

Replace the self-hosted Better Auth instance with **Neon Auth** (Neon's managed
authentication service), wired through the existing Vercel deployment. Primary
motivations: stop running/maintaining the auth server ourselves ("managed, less
to run") and integrate auth cleanly via the Neon–Vercel integration.

## Key context

- **Neon Auth is built on Better Auth** (managed REST service, currently Better
  Auth v1.4.18). This project is already on `better-auth ~1.4.21`, so this is a
  change of _where the auth server runs and where user tables live_ — not a
  swap between two unrelated auth systems.
- The framework-agnostic client package `@neondatabase/auth` (latest
  `0.4.2-beta`) defaults to the `BetterAuthVanillaAdapter`, which exposes the
  **same client API already in use**: `signIn.email`, `signUp.email`,
  `getSession`, `signOut`. It also exposes `getJWTToken()` (Neon Auth issues
  JWTs, with a JWKS endpoint).
- There is **no SvelteKit or generic server SDK** — only `@neondatabase/auth/next/server`.
  The SvelteKit server-side session check is therefore custom.
- **No data migration:** starting clean. Old `user`/`session`/`account`/
  `verification` tables and any dev accounts are dropped; Neon Auth owns users
  from scratch in the `neon_auth` schema.

## Decisions

- **Server session strategy: Approach A — forward cookie to Neon's get-session
  endpoint.** In `hooks.server.ts`, call
  `fetch('{NEON_AUTH_URL}/get-session', { headers: { cookie } })` and populate
  `event.locals`. Mirrors today's `auth.api.getSession()` behaviour 1:1, no
  crypto. (Approach B — local JWT verification against Neon's JWKS — is deferred;
  it's only needed if/when we adopt Neon RLS.)
- **Drop the FK to the local user table.** App tables (`course`, `module`,
  `lesson`, etc.) keep `userId` as a plain `text` column with **no enforced
  foreign key**. The `neon_auth.users_sync` table is eventually-consistent, so a
  hard FK to it is discouraged.

## Design

### 1. Dependencies & config

- Add `@neondatabase/auth`.
- Remove `better-auth` and `@better-auth/cli`.
- Drop the `auth:schema` script from `package.json`.

### 2. Enable Neon Auth & wire Vercel

- Enable Auth in the Neon Console (the `.neon` file already lists the `auth`
  feature). Obtain the **Auth URL**.
- Through the Neon–Vercel integration, env vars are injected into Vercel.
  Define:
  - `PUBLIC_NEON_AUTH_URL` — client-side (must be public in SvelteKit).
  - `NEON_AUTH_URL` — server-side (for the get-session fetch).
- Update `.env.example` and local `.env`/`.env.local`. Remove
  `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.

### 3. Client (`src/lib/auth-client.ts`)

```ts
import { createAuthClient } from '@neondatabase/auth';
import { PUBLIC_NEON_AUTH_URL } from '$env/static/public';

export const authClient = createAuthClient(PUBLIC_NEON_AUTH_URL);
```

`login/+page.svelte`, `signup/+page.svelte`, and `(app)/+layout.svelte` keep
calling `authClient.signIn.email` / `signUp.email` / `signOut` — expected to be
zero changes beyond the import. (Verify the returned object exposes these
directly vs. under `.adapter`; adjust the wrapper if needed.)

### 4. Server session (`src/hooks.server.ts`)

- Replace the local `betterAuth` call with Approach A: forward request cookies to
  `{NEON_AUTH_URL}/get-session`, parse `{ user, session }`, set
  `event.locals.user` / `event.locals.session`.
- **Delete `src/lib/server/auth.ts`** entirely.
- `src/lib/server/session.ts` (`requireUserId`), `(app)/+layout.server.ts`, and
  all `queries/*` are untouched — they only read `locals.user.id`.

### 5. Database schema

- **Delete `src/lib/server/db/auth.schema.ts`** (user/session/account/
  verification — Neon owns these in `neon_auth`).
- Remove the FK references to the local `user` table from `schema.ts`; keep
  `userId` as `text`. Drop the now-orphaned `user` import.
- Push the schema change to the clean dev DB (`db:push`).

### 6. `src/app.d.ts`

Replace the `better-auth` type imports with local interfaces describing the
`user`/`session` shape returned by Neon's get-session response.

### 7. Verification

- `bun run check` and `bun run lint` pass.
- Manual: sign up → redirected to `/agenda`; reload → session persists via
  hooks; sign out → redirected to `/login`.
- Deploy to a Vercel preview and confirm the full flow with injected env vars.

## Out of scope (YAGNI)

- Anonymous access / Neon RLS.
- Local JWT verification (Approach B).
- OAuth providers.
- Data migration (starting clean).

## Risks

- `@neondatabase/auth` is pre-1.0 (`0.4.2-beta`); API may shift.
- SvelteKit server integration is unofficial — the exact get-session endpoint
  path and cookie names need confirmation during implementation (small spike).

---

## REVISION (2026-06-14): Approach A (cookie forwarding) is broken — switch to a same-origin proxy

**What we got wrong.** The original design assumed the Neon Auth server is
same-origin with the app (as self-hosted Better Auth was). It is not. Neon Auth
is hosted on a **different origin** (`…neonauth.<region>.aws.neon.tech`).
Verified empirically: a real sign-up returns
`__Secure-neon-auth.session_token=…; HttpOnly; Secure; SameSite=None; Partitioned`
with **no `Domain`** — a host-only, partitioned third-party cookie. The browser
will never send it to the app's own domain, so `hooks.server.ts` forwarding
`event.request.headers.cookie` to `/get-session` always sees "no session" → an
infinite redirect to `/login` after a successful login.

**Neon's official server model is a same-origin proxy, and it ships Next-only.**
`@neondatabase/auth/next/server` exposes `createNeonAuth({ baseUrl, cookies })`

- `auth.handler()` — a route handler on the app's own domain that proxies to
  Neon and **rewrites Neon's host-only cookies into first-party app-domain
  cookies** (with a signed session-data cache). There is no SvelteKit or
  framework-agnostic server export, so on SvelteKit we hand-roll the proxy.

**Verified mechanic.** Forwarding the `__Secure-neon-auth.session_token` cookie
to `GET {NEON_AUTH_URL}/get-session` returns `{ user, session }` (HTTP 200);
without it, no session. So a same-origin proxy that holds the token first-party
and forwards it to get-session makes SSR auth work.

### Revised architecture: same-origin auth proxy

Browser → `/api/auth/*` (the app) → Neon. Cookies are first-party; the server
reads them normally.

1. **`src/routes/api/auth/[...path]/+server.ts`** — catch-all proxy (GET + POST).
   - Forwards method/body/`content-type` to `${NEON_AUTH_URL}/<path><search>`.
   - Sets the outbound `Origin` to a **fixed registered value** (`NEON_AUTH_ORIGIN`),
     NOT the incoming request's Origin (see preview-deploys below).
   - **Cookie name mapping (the crux):** the browser holds the token under a
     prefix-free name (`neon-auth.session_token`) so it works on `http://localhost`;
     the proxy re-adds the `__Secure-` prefix when forwarding to Neon (always
     HTTPS). On responses, rewrites Neon's `Set-Cookie` to first-party: strip the
     `__Secure-`/`__Host-` prefix, `HttpOnly; Path=/; SameSite=Lax`, and `Secure`
     only when the app is served over HTTPS.
2. **`src/lib/server/neon-auth.ts`** — keep `fetchSession`; add a shared
   cookie-name map helper. `hooks.server.ts` calls Neon `/get-session` with the
   mapped cookie; the redirect logic is unchanged. (Skip the Next SDK's signed
   session-data cache for now — YAGNI; accept one upstream call per SSR request.)
3. **`src/lib/auth-client.ts`** — point the client at the same-origin `/api/auth`
   path instead of the Neon URL.
4. **Env** — `NEON_AUTH_URL` (server/proxy) and new `NEON_AUTH_ORIGIN` (fixed
   origin sent to Neon). The client no longer needs `PUBLIC_NEON_AUTH_URL`.

### Vercel preview deployments

- **Cookies just work:** each preview is its own origin, so first-party cookies
  are scoped per preview domain automatically — no per-preview config.
- **Origin allowlist:** preview URLs are unpredictable, but the proxy sets the
  outbound `Origin` itself, so it always sends the single registered
  `NEON_AUTH_ORIGIN`. Register that one origin in Neon's trusted origins; every
  preview and prod pass the check. The browser never talks to Neon directly, so
  spoofing a constant Origin server-to-server is correct, not a security hole.
- **Open verification (not assumed):** the Neon–Vercel integration may provision
  a Neon branch — and possibly a per-branch Auth URL/trusted-origins — per
  preview. If so, the fixed-Origin registration must exist on whichever
  branch-auth each preview is wired to. Confirm this against the live Neon+Vercel
  integration during the preview test rather than assuming.

### Prerequisite (manual)

Add the app's registered origin(s) to Neon Auth's trusted/allowed origins in the
console (at minimum the production URL used as `NEON_AUTH_ORIGIN`).

### Spikes to resolve during implementation

- Whether `createAuthClient` accepts a relative/same-origin base URL vs. needing
  the app's absolute origin.
- The exact set of cookies Neon sets on sign-in and clears on sign-out (beyond
  `session_token`); the proxy's rewrite must handle all of them uniformly.
- End-to-end confirmation that dev `__Secure-` stripping works with a real
  browser login.

### Approach B (JWKS bridge) — rejected

Considered but not chosen: client stays cross-origin to Neon, a `/api/session`
route verifies the Neon JWT via JWKS (`/.well-known/jwks.json`, confirmed live)
and sets a first-party cookie; hooks verifies the JWT. Less code, but relies on
short-lived JWT refresh handling and diverges from Neon's intended model. The
proxy is session-token based (7-day, SDK-managed refresh) and faithful to the
official design.
