# Neon Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the self-hosted Better Auth instance with Neon's managed Neon Auth service, wired through Vercel, starting from a clean user database.

**Architecture:** The browser uses `@neondatabase/auth`'s default Better Auth client (same API as today) pointed at a hosted Neon Auth URL. `hooks.server.ts` validates the session per-request by forwarding the request cookies to Neon's hosted `get-session` endpoint (Approach A). Local `user`/`session`/`account`/`verification` tables are deleted; app tables keep `userId` as a plain `text` column with no enforced foreign key.

**Tech Stack:** SvelteKit, `@neondatabase/auth` (`0.4.2-beta`), Drizzle ORM (neon-http), Vitest, Vercel adapter.

**Reference spec:** `docs/superpowers/specs/2026-06-14-neon-auth-migration-design.md`

---

## File Structure

- `src/lib/server/neon-auth.ts` — **Create.** Pure, testable `fetchSession()` helper that calls Neon's get-session endpoint and normalises the response to `{ user, session } | null`.
- `src/lib/server/neon-auth.spec.ts` — **Create.** Unit tests for `fetchSession()` against a stub fetch.
- `src/hooks.server.ts` — **Modify.** Use `fetchSession()` to populate `event.locals`; drop all `better-auth` imports.
- `src/lib/auth-client.ts` — **Modify.** Use `createAuthClient(PUBLIC_NEON_AUTH_URL)` from `@neondatabase/auth`.
- `src/lib/server/auth.ts` — **Delete.** No local Better Auth instance anymore.
- `src/lib/server/db/auth.schema.ts` — **Delete.** Neon owns these tables in the `neon_auth` schema.
- `src/lib/server/db/schema.ts` — **Modify.** Drop `import { user }` and the 11 `.references(() => user.id, ...)` chains.
- `src/app.d.ts` — **Modify.** Replace `better-auth` types with local `AuthUser`/`AuthSession` interfaces.
- `.env.example`, `.env`, `.env.local` — **Modify.** Swap Better Auth vars for Neon Auth URLs.
- `package.json` — **Modify.** Add `@neondatabase/auth`; remove `better-auth`, `@better-auth/cli`, and the `auth:schema` script.

> **Important runtime note (neon-http):** per project memory, `db` uses `neon-http`, which has **no transactions** — use `db.batch()`, never `db.transaction()`. No transactions are introduced by this plan, but keep it in mind for any schema-push troubleshooting.

---

## Task 0: Enable Neon Auth and confirm endpoint shape (manual prerequisite + spike)

This task is done by you (the human) plus a short investigation. Implementation code in later tasks depends on the two unknowns it resolves: the **Auth URL** and the **exact get-session path / client return shape**.

**Files:** none (investigation only)

- [ ] **Step 1: Enable Neon Auth**

In the Neon Console, go to Project → Branch → **Auth** and enable it (the repo's `.neon` file already lists the `auth` feature). Copy the **Auth URL** it gives you.

- [ ] **Step 2: Set local env vars**

Add to `.env.local` (used by `vite dev`):

```bash
PUBLIC_NEON_AUTH_URL="<paste the Auth URL from the console>"
NEON_AUTH_URL="<paste the same Auth URL>"
```

- [ ] **Step 3: Confirm the get-session endpoint**

Neon Auth is Better Auth under the hood; its session endpoint is conventionally `GET <AUTH_URL>/get-session` (some deployments mount under `/api/auth/get-session`). Confirm which one your URL uses:

```bash
curl -i "$NEON_AUTH_URL/get-session"
```

Expected: HTTP 200 with a JSON body (likely `null` or `{}` when unauthenticated), **not** 404. If you get 404, try `"$NEON_AUTH_URL/api/auth/get-session"`. Record the working path — it is the value used for `SESSION_PATH` in Task 3.

- [ ] **Step 4: Confirm the client return shape**

In a scratch node REPL or a throwaway `+page.svelte`, log the object returned by `createAuthClient(url)` and check whether `signIn.email` is exposed directly (`client.signIn.email`) or under `client.adapter` (`client.adapter.signIn.email`). The published types show a `{ adapter, getJWTToken }` wrapper, but the docs' examples call methods directly — confirm which is real. Record the answer; it determines the `auth-client.ts` export in Task 6.

---

## Task 1: Add the Neon Auth dependency

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run:

```bash
bun add @neondatabase/auth
```

Expected: `@neondatabase/auth` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "build: add @neondatabase/auth"
```

---

## Task 2: Server session helper (`fetchSession`) — test first

**Files:**

- Create: `src/lib/server/neon-auth.ts`
- Test: `src/lib/server/neon-auth.spec.ts`

The helper isolates the one piece of real logic (call Neon's get-session, normalise the result) so it can be unit-tested with a stub `fetch`, independent of the SvelteKit request lifecycle.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/neon-auth.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchSession } from './neon-auth';

const BASE = 'https://auth.example.com';
const SESSION_PATH = '/get-session';

describe('fetchSession', () => {
	it('returns null when there is no cookie header', async () => {
		const fetchFn = vi.fn();
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, '');
		expect(result).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('forwards the cookie and returns user + session on success', async () => {
		const body = {
			user: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
			session: { id: 's1', userId: 'u1', expiresAt: '2030-01-01T00:00:00Z' }
		};
		const fetchFn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));

		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');

		expect(fetchFn).toHaveBeenCalledWith(`${BASE}${SESSION_PATH}`, {
			headers: { cookie: 'better-auth.session=abc' }
		});
		expect(result).toEqual(body);
	});

	it('returns null on a non-OK response', async () => {
		const fetchFn = vi.fn(async () => new Response('nope', { status: 401 }));
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});

	it('returns null when the body has no user', async () => {
		const fetchFn = vi.fn(async () => new Response(JSON.stringify(null), { status: 200 }));
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});

	it('returns null when fetch throws', async () => {
		const fetchFn = vi.fn(async () => {
			throw new Error('network');
		});
		const result = await fetchSession(fetchFn, BASE, SESSION_PATH, 'better-auth.session=abc');
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/server/neon-auth.spec.ts`
Expected: FAIL — cannot resolve `./neon-auth` / `fetchSession is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/neon-auth.ts`:

```ts
export interface AuthUser {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean;
	image?: string | null;
}

export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: string;
}

export interface SessionResult {
	user: AuthUser;
	session: AuthSession;
}

type FetchFn = typeof fetch;

/**
 * Validate the request's session against Neon Auth's hosted get-session endpoint
 * by forwarding the incoming cookie header. Returns null for any unauthenticated
 * or error case so callers can treat "no session" uniformly.
 */
export async function fetchSession(
	fetchFn: FetchFn,
	baseUrl: string,
	sessionPath: string,
	cookie: string
): Promise<SessionResult | null> {
	if (!cookie) return null;

	try {
		const res = await fetchFn(`${baseUrl}${sessionPath}`, { headers: { cookie } });
		if (!res.ok) return null;
		const data = (await res.json()) as Partial<SessionResult> | null;
		if (!data?.user || !data?.session) return null;
		return { user: data.user, session: data.session };
	} catch {
		return null;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/server/neon-auth.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/neon-auth.ts src/lib/server/neon-auth.spec.ts
git commit -m "feat(auth): add Neon Auth get-session helper"
```

---

## Task 3: Rewrite `hooks.server.ts` and delete the local auth instance

**Files:**

- Modify: `src/hooks.server.ts`
- Delete: `src/lib/server/auth.ts`

> Use the working get-session path recorded in **Task 0 Step 3** as `SESSION_PATH`. The example below uses `/get-session`; change it if your console URL needs `/api/auth/get-session`.

- [ ] **Step 1: Replace the hooks file**

Overwrite `src/hooks.server.ts` with:

```ts
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fetchSession } from '$lib/server/neon-auth';

const SESSION_PATH = '/get-session';

export const handle: Handle = async ({ event, resolve }) => {
	const baseUrl = env.NEON_AUTH_URL;
	if (baseUrl) {
		const cookie = event.request.headers.get('cookie') ?? '';
		const result = await fetchSession(fetch, baseUrl, SESSION_PATH, cookie);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		}
	}
	return resolve(event);
};
```

- [ ] **Step 2: Delete the local Better Auth instance**

Run:

```bash
git rm src/lib/server/auth.ts
```

- [ ] **Step 3: Verify type-check passes**

Run: `bun run check`
Expected: PASS (note: `app.d.ts` still references `better-auth` until Task 4 — if `check` reports an error only in `app.d.ts`, that is expected and fixed next; there must be no errors in `hooks.server.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat(auth): validate sessions via Neon Auth in hooks; drop local auth instance"
```

---

## Task 4: Update `app.d.ts` types

**Files:**

- Modify: `src/app.d.ts`

- [ ] **Step 1: Replace the type declarations**

Overwrite `src/app.d.ts` with:

```ts
import type { AuthUser, AuthSession } from '$lib/server/neon-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: AuthUser;
			session?: AuthSession;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
```

- [ ] **Step 2: Verify type-check passes**

Run: `bun run check`
Expected: PASS with no errors (the `better-auth` reference is gone). `(app)/+layout.server.ts` and `session.ts` still compile because `AuthUser` has `id`, `name`, `email`.

- [ ] **Step 3: Commit**

```bash
git add src/app.d.ts
git commit -m "refactor(auth): type Locals from Neon Auth session shape"
```

---

## Task 5: Repoint the client and verify the UI pages

**Files:**

- Modify: `src/lib/auth-client.ts`
- Read/verify: `src/routes/login/+page.svelte`, `src/routes/signup/+page.svelte`, `src/routes/(app)/+layout.svelte`

> Use the client shape recorded in **Task 0 Step 4**. The version below assumes methods are exposed directly. If Task 0 found them under `.adapter`, export `createAuthClient(PUBLIC_NEON_AUTH_URL).adapter` instead.

- [ ] **Step 1: Replace the client**

Overwrite `src/lib/auth-client.ts` with:

```ts
import { createAuthClient } from '@neondatabase/auth';
import { PUBLIC_NEON_AUTH_URL } from '$env/static/public';

export const authClient = createAuthClient(PUBLIC_NEON_AUTH_URL);
```

- [ ] **Step 2: Verify the consuming pages need no changes**

Confirm these call sites still type-check against the new client (they use the Better Auth API, which the default adapter preserves):

- `login/+page.svelte`: `authClient.signIn.email({ email, password })`
- `signup/+page.svelte`: `authClient.signUp.email({ name, email, password })`
- `(app)/+layout.svelte`: `authClient.signOut()`

Run: `bun run check`
Expected: PASS. If `signIn`/`signUp`/`signOut` are reported missing, the client exposes them under `.adapter` — apply the `.adapter` change from the task note and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat(auth): point auth client at Neon Auth"
```

---

## Task 6: Remove user FKs from the app schema and delete the auth schema

**Files:**

- Delete: `src/lib/server/db/auth.schema.ts`
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Delete the auth schema file**

Run:

```bash
git rm src/lib/server/db/auth.schema.ts
```

- [ ] **Step 2: Remove the user import from `schema.ts`**

In `src/lib/server/db/schema.ts`, delete line 2:

```ts
import { user } from './auth.schema';
```

- [ ] **Step 3: Strip all 11 user FK chains**

In `src/lib/server/db/schema.ts`, every `userId` column currently reads like:

```ts
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
```

Remove the `.references(() => user.id, { onDelete: 'cascade' })` line from **all 11** occurrences (at indentation of both two and three tabs), leaving the column as `userId: text('user_id').notNull(),`. **Preserve** the `.unique()` on `timetableConfig.userId` — it becomes:

```ts
	userId: text('user_id').notNull().unique(),
```

Do **not** touch the other `.references(...)` calls that point at `course.id`, `module.id`, `klass.id`, `lesson.id`, or `scheduledLesson.id` — those FKs stay.

- [ ] **Step 4: Verify no `user.id` references remain**

Run: `grep -n "user.id\|auth.schema" src/lib/server/db/schema.ts`
Expected: no output.

- [ ] **Step 5: Verify type-check passes**

Run: `bun run check`
Expected: PASS with no errors.

- [ ] **Step 6: Push the schema to the clean dev database**

> Starting clean per the spec. This drops the old auth tables' relationships; Neon Auth manages users in the `neon_auth` schema separately. Ensure `DATABASE_URL` points at the dev branch you intend to wipe.

Run:

```bash
bun run db:push
```

Expected: drizzle-kit applies the column changes (FK constraints to `user` removed) without error. If it prompts about dropping the `user`/`session`/`account`/`verification` tables and you no longer manage them via drizzle, accept — Neon Auth owns its own schema.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(db): drop local user tables and FKs; userId is plain text"
```

---

## Task 7: Remove Better Auth dependencies and scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Remove the packages**

Run:

```bash
bun remove better-auth @better-auth/cli
```

- [ ] **Step 2: Remove the `auth:schema` script**

In `package.json`, delete the `"auth:schema": "better-auth generate ..."` line from `scripts`.

- [ ] **Step 3: Verify nothing still imports better-auth**

Run: `grep -rn "better-auth" src/ package.json`
Expected: no output.

- [ ] **Step 4: Verify check and lint pass**

Run: `bun run check && bun run lint`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "build: remove better-auth and @better-auth/cli"
```

---

## Task 8: Update env templates and Vercel configuration

**Files:**

- Modify: `.env.example`
- Modify: `.env`

- [ ] **Step 1: Update `.env.example`**

Replace the Better Auth entries with Neon Auth entries. The file should declare:

```bash
DATABASE_URL=
PUBLIC_NEON_AUTH_URL=
NEON_AUTH_URL=
```

Remove `BETTER_AUTH_SECRET` and `ORIGIN`.

- [ ] **Step 2: Clean up `.env`**

Remove `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` from `.env`. (Keep the Blob vars.) Ensure `PUBLIC_NEON_AUTH_URL` and `NEON_AUTH_URL` are present where dev/preview needs them (already added to `.env.local` in Task 0).

- [ ] **Step 3: Set Vercel env vars**

In the Vercel project (or via the Neon–Vercel integration, which can inject these automatically), set `PUBLIC_NEON_AUTH_URL` and `NEON_AUTH_URL` for Preview and Production. Remove `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: env template for Neon Auth"
```

> `.env` and `.env.local` are gitignored — do not commit them.

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test + check + lint**

Run: `bun run test:unit -- --run && bun run check && bun run lint`
Expected: all PASS.

- [ ] **Step 2: Manual local flow**

Run `bun run dev`, then in the browser:

1. Visit `/signup`, create an account → expect redirect to `/agenda`.
2. Reload `/agenda` → still authenticated (session validated by hooks).
3. Create a course → confirm it persists (writes use `locals.user.id`).
4. Click **Sign out** → expect redirect to `/login`.
5. Visit `/agenda` while signed out → expect redirect to `/login`.

- [ ] **Step 3: Vercel preview**

Push the branch and open the Vercel preview deploy. Repeat Step 2's signup → reload → sign-out flow against the preview, confirming the injected `PUBLIC_NEON_AUTH_URL` / `NEON_AUTH_URL` work end to end.

- [ ] **Step 4: Final confirmation**

Confirm: no `better-auth` references remain (`grep -rn better-auth src/ package.json` is empty), all checks green, and both local and preview auth flows work.
