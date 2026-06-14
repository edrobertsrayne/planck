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
  change of *where the auth server runs and where user tables live* — not a
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
