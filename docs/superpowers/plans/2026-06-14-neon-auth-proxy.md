# Neon Auth Same-Origin Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Neon Auth work with SvelteKit SSR by routing all auth through a same-origin proxy that rewrites Neon's host-only third-party cookies into first-party app-domain cookies.

**Architecture:** Browser → `/api/auth/*` (SvelteKit catch-all proxy) → Neon auth server. The proxy maps cookie names (prefix-free first-party ↔ `__Secure-` for Neon) and sets a fixed registered `Origin` outbound. `hooks.server.ts` validates the session by forwarding the (mapped) first-party cookie to Neon `/get-session`. The browser never talks to Neon directly.

**Tech Stack:** SvelteKit, `@neondatabase/auth` (`0.4.2-beta`), Vitest, Vercel adapter.

**Reference spec:** `docs/superpowers/specs/2026-06-14-neon-auth-migration-design.md` (see the REVISION section).

**Builds on branch:** `feat/neon-auth-migration` (Tasks 1–8 of the prior plan are done; this plan replaces the broken cookie-forwarding model from that plan's Task 3).

---

## Background facts (verified, do not re-derive)

- Neon sets exactly one auth cookie on sign-in: `__Secure-neon-auth.session_token` (`HttpOnly; Secure; SameSite=None; Partitioned`, no `Domain`). Sign-out may set a clearing cookie; handle all cookies uniformly.
- `GET {NEON_AUTH_URL}/get-session` with that cookie (sent under the `__Secure-` name) returns `{ user, session }`; without it returns 200 with an empty/null body.
- Neon requires an `Origin` header on auth POSTs (returns `400 MISSING_ORIGIN` otherwise) and echoes `access-control-allow-credentials: true`.
- `NEON_AUTH_URL` (already in `.env`) = `https://ep-…neonauth.eu-west-2.aws.neon.tech/neondb/auth` — note it already includes the `/neondb/auth` base path; the proxy appends `/<path>` to it.
- `fetchSession(fetchFn, baseUrl, sessionPath, cookie)` already exists in `src/lib/server/neon-auth.ts` and returns `{ user, session } | null`.

---

## File Structure

- `src/lib/server/neon-auth-cookies.ts` — **Create.** Pure helpers: `toNeonCookie(cookieHeader)` (first-party → `__Secure-` names for sending to Neon) and `toFirstPartySetCookie(setCookieValue, { secure })` (rewrite a Neon `Set-Cookie` to first-party). Plus constants for the name prefix.
- `src/lib/server/neon-auth-cookies.spec.ts` — **Create.** Unit tests for both helpers.
- `src/routes/api/auth/[...path]/+server.ts` — **Create.** Catch-all GET/POST proxy to Neon using the cookie helpers + fixed `Origin`.
- `src/hooks.server.ts` — **Modify.** Map the incoming first-party cookie to the Neon name before calling `fetchSession`.
- `src/lib/auth-client.ts` — **Modify.** Point `createAuthClient` at the same-origin `/api/auth` base.
- `.env`, `.env.example` — **Modify.** Add `NEON_AUTH_ORIGIN`; the client no longer needs `PUBLIC_NEON_AUTH_URL`.

---

## Task 1: Cookie-mapping helpers (test first)

**Files:**

- Create: `src/lib/server/neon-auth-cookies.ts`
- Test: `src/lib/server/neon-auth-cookies.spec.ts`

The proxy needs two transforms, isolated here so they're unit-testable without HTTP:

- **Outbound (app → Neon):** the browser holds the session token under a prefix-free name `neon-auth.session_token`; Neon expects `__Secure-neon-auth.session_token`. Re-add the `__Secure-` prefix on any `neon-auth.*` cookie.
- **Inbound (Neon → app):** Neon's `Set-Cookie` uses `__Secure-…; SameSite=None; Partitioned` (no `Domain`). Rewrite to first-party: strip the `__Secure-`/`__Host-` prefix from the name, force `Path=/; HttpOnly; SameSite=Lax`, drop `Partitioned` and `Domain`, and include `Secure` only when `secure` is true (HTTPS).

- [ ] **Step 1: Write the failing test** — create `src/lib/server/neon-auth-cookies.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toNeonCookie, toFirstPartySetCookie } from './neon-auth-cookies';

describe('toNeonCookie', () => {
	it('adds the __Secure- prefix to neon-auth cookies', () => {
		expect(toNeonCookie('neon-auth.session_token=abc')).toBe(
			'__Secure-neon-auth.session_token=abc'
		);
	});

	it('passes through unrelated cookies unchanged and preserves order', () => {
		expect(toNeonCookie('foo=1; neon-auth.session_token=abc; bar=2')).toBe(
			'foo=1; __Secure-neon-auth.session_token=abc; bar=2'
		);
	});

	it('does not double-prefix an already-prefixed cookie', () => {
		expect(toNeonCookie('__Secure-neon-auth.session_token=abc')).toBe(
			'__Secure-neon-auth.session_token=abc'
		);
	});

	it('returns empty string for empty input', () => {
		expect(toNeonCookie('')).toBe('');
	});
});

describe('toFirstPartySetCookie', () => {
	it('strips __Secure- prefix, drops Partitioned/Domain, sets SameSite=Lax, adds Secure when https', () => {
		const input =
			'__Secure-neon-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None; Partitioned';
		const out = toFirstPartySetCookie(input, { secure: true });
		expect(out).toContain('neon-auth.session_token=abc');
		expect(out).not.toContain('__Secure-');
		expect(out).not.toMatch(/Partitioned/i);
		expect(out).not.toMatch(/Domain=/i);
		expect(out).toMatch(/SameSite=Lax/i);
		expect(out).toMatch(/HttpOnly/i);
		expect(out).toMatch(/Path=\//i);
		expect(out).toMatch(/Secure/i);
		expect(out).toMatch(/Max-Age=604800/i);
	});

	it('omits Secure when not https (dev)', () => {
		const input = '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Secure; SameSite=None';
		const out = toFirstPartySetCookie(input, { secure: false });
		expect(out).not.toMatch(/(^|;|\s)Secure(;|$)/i);
		expect(out).toContain('neon-auth.session_token=abc');
	});

	it('preserves a deletion cookie (empty value, Max-Age=0)', () => {
		const input =
			'__Secure-neon-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None';
		const out = toFirstPartySetCookie(input, { secure: true });
		expect(out).toContain('neon-auth.session_token=;');
		expect(out).toMatch(/Max-Age=0/i);
	});
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `bun run test:unit -- --run src/lib/server/neon-auth-cookies.spec.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write the implementation** — create `src/lib/server/neon-auth-cookies.ts`:

```ts
const SECURE_PREFIX = '__Secure-';
const HOST_PREFIX = '__Host-';
const NEON_COOKIE_BASE = 'neon-auth.';

/**
 * Rewrite an outgoing Cookie header (first-party names held by the browser) into
 * the names Neon expects. The browser stores `neon-auth.*` without the
 * `__Secure-` prefix so it works on http://localhost; Neon (always HTTPS) expects
 * the prefixed name.
 */
export function toNeonCookie(cookieHeader: string): string {
	if (!cookieHeader) return '';
	return cookieHeader
		.split(';')
		.map((part) => {
			const trimmed = part.trim();
			const eq = trimmed.indexOf('=');
			if (eq === -1) return part;
			const name = trimmed.slice(0, eq);
			const value = trimmed.slice(eq + 1);
			if (name.startsWith(NEON_COOKIE_BASE)) {
				return `${SECURE_PREFIX}${name}=${value}`;
			}
			return trimmed;
		})
		.join('; ');
}

/**
 * Rewrite a Set-Cookie value from Neon into a first-party app cookie:
 * - strip the `__Secure-`/`__Host-` name prefix (so the cookie works on http dev)
 * - drop `Domain` (host-only) and `Partitioned`
 * - force `Path=/`, `HttpOnly`, `SameSite=Lax`
 * - include `Secure` only when the app is served over HTTPS
 */
export function toFirstPartySetCookie(setCookie: string, opts: { secure: boolean }): string {
	const segments = setCookie.split(';').map((s) => s.trim());
	const [nameValue, ...attrs] = segments;

	const eq = nameValue.indexOf('=');
	let name = eq === -1 ? nameValue : nameValue.slice(0, eq);
	const value = eq === -1 ? '' : nameValue.slice(eq + 1);
	if (name.startsWith(SECURE_PREFIX)) name = name.slice(SECURE_PREFIX.length);
	else if (name.startsWith(HOST_PREFIX)) name = name.slice(HOST_PREFIX.length);

	const kept: string[] = [];
	for (const attr of attrs) {
		const lower = attr.toLowerCase();
		if (
			lower === 'secure' ||
			lower === 'partitioned' ||
			lower === 'httponly' ||
			lower.startsWith('domain=') ||
			lower.startsWith('path=') ||
			lower.startsWith('samesite=')
		) {
			continue; // we re-add the ones we want below
		}
		kept.push(attr); // keep Max-Age / Expires etc.
	}

	const out = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', ...kept];
	if (opts.secure) out.push('Secure');
	return out.join('; ');
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `bun run test:unit -- --run src/lib/server/neon-auth-cookies.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/neon-auth-cookies.ts src/lib/server/neon-auth-cookies.spec.ts
git commit -m "feat(auth): cookie-mapping helpers for Neon Auth proxy"
```

---

## Task 2: The catch-all proxy route

**Files:**

- Create: `src/routes/api/auth/[...path]/+server.ts`

This proxies every Better Auth endpoint to Neon. It forwards method, body, and content-type; sends the mapped cookies and a fixed `Origin`; relays the response; and rewrites every `Set-Cookie` to first-party.

- [ ] **Step 1: Write the route** — create `src/routes/api/auth/[...path]/+server.ts`:

```ts
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { toNeonCookie, toFirstPartySetCookie } from '$lib/server/neon-auth-cookies';

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const { request, params, url } = event;
	const baseUrl = env.NEON_AUTH_URL;
	if (!baseUrl) return new Response('NEON_AUTH_URL not set', { status: 500 });

	const target = `${baseUrl}/${params.path}${url.search}`;

	const headers = new Headers();
	const contentType = request.headers.get('content-type');
	if (contentType) headers.set('content-type', contentType);
	const cookie = request.headers.get('cookie') ?? '';
	if (cookie) headers.set('cookie', toNeonCookie(cookie));
	// Neon validates Origin against its trusted list; always send the registered one.
	headers.set('origin', env.NEON_AUTH_ORIGIN ?? url.origin);

	const body =
		request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

	const upstream = await fetch(target, {
		method: request.method,
		headers,
		body,
		redirect: 'manual'
	});

	const secure = url.protocol === 'https:';
	const resHeaders = new Headers();
	for (const [key, value] of upstream.headers) {
		const lower = key.toLowerCase();
		if (lower === 'set-cookie') continue; // handled below
		if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding')
			continue; // let the platform recompute
		resHeaders.set(key, value);
	}
	// getSetCookie() returns each Set-Cookie separately (Node/undici + SvelteKit support it).
	for (const sc of upstream.headers.getSetCookie?.() ?? []) {
		resHeaders.append('set-cookie', toFirstPartySetCookie(sc, { secure }));
	}

	const resBody = await upstream.arrayBuffer();
	return new Response(resBody, { status: upstream.status, headers: resHeaders });
}

export const GET: RequestHandler = (event) => proxy(event);
export const POST: RequestHandler = (event) => proxy(event);
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: PASS, no errors. (If `getSetCookie` typing complains, the `?.()` guard already covers absence; keep as written.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/auth/
git commit -m "feat(auth): same-origin proxy route to Neon Auth"
```

---

## Task 3: Validate sessions in hooks via the mapped cookie

**Files:**

- Modify: `src/hooks.server.ts`

The session cookie is now first-party (`neon-auth.session_token`). To validate, map it to the Neon name and call `/get-session` directly (the existing `fetchSession` helper).

- [ ] **Step 1: Replace `src/hooks.server.ts` with:**

```ts
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fetchSession } from '$lib/server/neon-auth';
import { toNeonCookie } from '$lib/server/neon-auth-cookies';

const SESSION_PATH = '/get-session';

export const handle: Handle = async ({ event, resolve }) => {
	const baseUrl = env.NEON_AUTH_URL;
	if (baseUrl) {
		const cookie = toNeonCookie(event.request.headers.get('cookie') ?? '');
		const result = await fetchSession(fetch, baseUrl, SESSION_PATH, cookie);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		}
	}
	return resolve(event);
};
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat(auth): validate session from first-party cookie in hooks"
```

---

## Task 4: Point the auth client at the same-origin proxy

**Files:**

- Modify: `src/lib/auth-client.ts`

SPIKE: confirm whether `createAuthClient` accepts a relative base (`/api/auth`) or needs an absolute URL. Better Auth's client generally accepts a path and resolves it against `window.location`. Try relative first; if it throws/misbehaves, fall back to `\`${window.location.origin}/api/auth\``.

- [ ] **Step 1: Replace `src/lib/auth-client.ts` with:**

```ts
import { browser } from '$app/environment';
import { createAuthClient } from '@neondatabase/auth';

// The client talks to the same-origin proxy, which forwards to Neon and rewrites
// cookies to first-party. Absolute origin avoids any ambiguity during the brief
// SSR import window (the client only issues requests in the browser).
const baseURL = browser ? `${window.location.origin}/api/auth` : '/api/auth';

export const authClient = createAuthClient(baseURL);
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: PASS. (If `signIn`/`signUp`/`signOut` aren't found on the client, the methods are under `.adapter`; this was confirmed NOT the case in the prior plan, so it should be fine.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat(auth): point auth client at same-origin proxy"
```

---

## Task 5: Environment variables

**Files:**

- Modify: `.env`, `.env.example`

- [ ] **Step 1: Update `.env.example`** to list EVERY env var the app reads.

The complete set the code accesses (audited via `grep -rhoE "env\.[A-Z_]+" src/`):
`DATABASE_URL`, `NEON_AUTH_URL`, `NEON_AUTH_ORIGIN`, `BLOB_READ_WRITE_TOKEN`.
(`PUBLIC_NEON_AUTH_URL` is removed in this plan; `DATABASE_URL_UNPOOLED` /
`BLOB_STORE_ID` are injected by the Neon/Vercel integrations and not read by app
code, so they are intentionally omitted.) Write `.env.example` as:

```bash
# Drizzle / Neon Postgres
DATABASE_URL="postgres://user:password@host:port/db-name"

# Neon Auth (server-side; the browser uses the same-origin /api/auth proxy)
NEON_AUTH_URL=""
# Fixed origin registered in Neon's trusted origins (e.g. your production URL).
# The proxy always sends this as the Origin header so unpredictable Vercel
# preview URLs still pass Neon's origin check.
NEON_AUTH_ORIGIN=""

# Vercel Blob (lesson file uploads). On Vercel this is auto-injected; set it
# locally for dev parity.
BLOB_READ_WRITE_TOKEN=""
```

- [ ] **Step 2: Update `.env`** — remove `PUBLIC_NEON_AUTH_URL` (no longer used by the client) and add `NEON_AUTH_ORIGIN` set to the dev origin for local testing, e.g.:

```bash
NEON_AUTH_ORIGIN="http://localhost:5173"
```

Keep `NEON_AUTH_URL` as-is. (`.env`/`.env.local` are gitignored — do not commit them.)

- [ ] **Step 3: Commit the template only**

```bash
git add .env.example
git commit -m "chore: env for Neon Auth proxy (NEON_AUTH_ORIGIN)"
```

---

## Task 6: Verification

**Files:** none (verification only)

- [ ] **Step 1: Automated**

Run: `bun run test:unit -- --run --project server && bun run check && bun run lint`
Expected: all PASS. (Run the `server` project alone to avoid the known unrelated `@milkdown/crepe` browser-test flake.)

- [ ] **Step 2: Manual dev login (the real end-to-end test)**

> Prerequisite: `http://localhost:5173` (or whatever dev origin you use) must be in Neon Auth's trusted origins, and `NEON_AUTH_ORIGIN` in `.env` must match it.

Run `bun run dev`, then in a browser:

1. Go to `/signup`, create an account → expect redirect to `/agenda` and that it **stays** there (no bounce to `/login`).
2. Open dev tools → Application → Cookies: confirm a first-party `neon-auth.session_token` cookie on `localhost` (no `__Secure-` prefix, present on the app domain).
3. Reload `/agenda` → still authenticated (hooks validated the first-party cookie server-side).
4. Sign out → redirect to `/login`; confirm the cookie is cleared.
5. Visit `/agenda` while signed out → redirect to `/login`.

If step 1 bounces back to `/login`, capture the Network tab for `/api/auth/sign-up/email` and `/agenda`, and the `set-cookie` on the sign-up response, and report — do not guess.

- [ ] **Step 3: Vercel preview**

Push the branch; in the Vercel preview set `NEON_AUTH_URL` and `NEON_AUTH_ORIGIN` (and ensure `NEON_AUTH_ORIGIN` is registered in Neon's trusted origins). Repeat Step 2's signup → reload → signout against the preview URL. **Also confirm** whether the Neon–Vercel integration provisioned a per-branch Auth URL for the preview (check the injected `NEON_AUTH_URL`); if it differs from prod, ensure that branch-auth has the registered origin too.

- [ ] **Step 4: Final review**

Dispatch a code-quality review of the proxy + cookie helpers (focus: correctness of cookie rewriting, no header smuggling, no secret leakage, GET/POST coverage). Then use `superpowers:finishing-a-development-branch`.
