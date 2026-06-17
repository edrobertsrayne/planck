# Google OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Continue with Google" button to the `/login` and `/signup` pages that authenticates via Neon Auth's social sign-in.

**Architecture:** A single self-contained `OAuthButtons.svelte` component owns the Google button, the `signIn.social` click handler, and its own error alert. Both pages render it below their email/password form, separated by an "or" divider. No changes to the auth client or the `/api/auth` proxy — `signIn.social` and the proxy's redirect rewriting already support the round-trip.

**Tech Stack:** SvelteKit (Svelte 5 runes), `@neondatabase/auth` better-auth client, Tailwind, vitest-browser-svelte for component tests.

---

## File Structure

- **Create** `src/lib/components/OAuthButtons.svelte` — Google button + handler + error alert + inline brand logo. Single responsibility: start a Google OAuth sign-in and report failures locally.
- **Create** `src/lib/components/OAuthButtons.svelte.test.ts` — component tests with a mocked auth client.
- **Modify** `src/routes/login/+page.svelte` — render `<OAuthButtons />` below the form with an "or" divider.
- **Modify** `src/routes/signup/+page.svelte` — same.

No changes to `src/lib/auth-client.ts` or `src/routes/api/auth/[...path]/+server.ts`.

---

## Task 1: OAuthButtons component

**Files:**

- Create: `src/lib/components/OAuthButtons.svelte`
- Test: `src/lib/components/OAuthButtons.svelte.test.ts`

- [ ] **Step 1: Write the failing happy-path test**

Create `src/lib/components/OAuthButtons.svelte.test.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test, vi, beforeEach } from 'vitest';
import OAuthButtons from './OAuthButtons.svelte';
import { authClient } from '$lib/auth-client';

vi.mock('$lib/auth-client', () => ({
	authClient: { signIn: { social: vi.fn() } }
}));

const social = authClient.signIn.social as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
	social.mockReset();
});

test('clicking the Google button starts a google social sign-in to /agenda', async () => {
	social.mockReturnValue(new Promise(() => {})); // never resolves (redirect in flight)
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	expect(social).toHaveBeenCalledTimes(1);
	expect(social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/agenda' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/OAuthButtons.svelte.test.ts`
Expected: FAIL — cannot resolve `./OAuthButtons.svelte` (file does not exist yet).

- [ ] **Step 3: Write the minimal component**

Create `src/lib/components/OAuthButtons.svelte`:

```svelte
<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { callbackURL = '/agenda' }: { callbackURL?: string } = $props();

	let isRedirecting = $state(false);

	async function google() {
		isRedirecting = true;
		await authClient.signIn.social({ provider: 'google', callbackURL });
		// success → browser redirects to Google; nothing else runs
	}
</script>

<button
	type="button"
	onclick={google}
	disabled={isRedirecting}
	class="flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] border border-line bg-white text-[15.5px] font-semibold text-grey-1 transition hover:border-pink-200 disabled:cursor-not-allowed disabled:opacity-60"
>
	<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
		<path
			fill="#4285F4"
			d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
		/>
		<path
			fill="#34A853"
			d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
		/>
		<path
			fill="#FBBC05"
			d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
		/>
		<path
			fill="#EA4335"
			d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
		/>
	</svg>
	Continue with Google
</button>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/OAuthButtons.svelte.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the failing error-handling tests**

Append to `src/lib/components/OAuthButtons.svelte.test.ts`:

```ts
test('surfaces the provider error message in an alert', async () => {
	social.mockResolvedValue({ error: { message: 'Google is unavailable' } });
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent('Google is unavailable');
});

test('surfaces a fallback message when the call throws', async () => {
	social.mockRejectedValue(new Error('network down'));
	const screen = render(OAuthButtons);
	await screen.getByRole('button', { name: /continue with google/i }).click();
	await expect
		.element(screen.getByRole('alert'))
		.toHaveTextContent('Unable to continue with Google. Please try again.');
});
```

- [ ] **Step 6: Run the tests to verify the new ones fail**

Run: `bun run test:unit -- --run src/lib/components/OAuthButtons.svelte.test.ts`
Expected: the two new tests FAIL — no `role="alert"` element is rendered (the component has no error state yet).

- [ ] **Step 7: Add error handling to the component**

In `src/lib/components/OAuthButtons.svelte`, replace the `<script>` body's handler and state, and add the alert to the markup.

Replace the script's state + handler with:

```svelte
<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { callbackURL = '/agenda' }: { callbackURL?: string } = $props();

	let isRedirecting = $state(false);
	let error = $state('');
	const fallback = 'Unable to continue with Google. Please try again.';

	async function google() {
		error = '';
		isRedirecting = true;
		try {
			const res = await authClient.signIn.social({ provider: 'google', callbackURL });
			if (res?.error) {
				error = res.error.message ?? fallback;
				isRedirecting = false;
			}
			// success → browser redirects to Google; nothing else runs
		} catch (err) {
			error = (err as { message?: string })?.message ?? fallback;
			isRedirecting = false;
		}
	}
</script>
```

Add the alert immediately after the closing `</button>` tag:

```svelte
{#if error}<p role="alert" class="mt-2 text-sm text-danger">{error}</p>{/if}
```

- [ ] **Step 8: Run the tests to verify all pass**

Run: `bun run test:unit -- --run src/lib/components/OAuthButtons.svelte.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/OAuthButtons.svelte src/lib/components/OAuthButtons.svelte.test.ts
git commit -m "feat: add OAuthButtons component for Google sign-in (#5)"
```

---

## Task 2: Wire OAuthButtons into the login page

**Files:**

- Modify: `src/routes/login/+page.svelte`

- [ ] **Step 1: Import the component**

In `src/routes/login/+page.svelte`, add the import after the existing `BrandPanel` import (line 4):

```svelte
import OAuthButtons from '$lib/components/OAuthButtons.svelte';
```

- [ ] **Step 2: Render the divider + button below the form**

In `src/routes/login/+page.svelte`, the form ends with `</form>` (currently line 79). Immediately after `</form>`, inside the same `<div class="w-full max-w-[392px]">` wrapper, add:

```svelte
<div class="my-5 flex items-center gap-3 text-[13px] text-grey-2">
	<span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span>
</div>
<OAuthButtons />
```

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/login/+page.svelte
git commit -m "feat: add Google sign-in to login page (#5)"
```

---

## Task 3: Wire OAuthButtons into the signup page

**Files:**

- Modify: `src/routes/signup/+page.svelte`

- [ ] **Step 1: Import the component**

In `src/routes/signup/+page.svelte`, add the import after the existing `BrandPanel` import (line 4):

```svelte
import OAuthButtons from '$lib/components/OAuthButtons.svelte';
```

- [ ] **Step 2: Render the divider + button below the form**

In `src/routes/signup/+page.svelte`, the form ends with `</form>` (currently line 87). Immediately after `</form>`, inside the same `<div class="w-full max-w-[392px]">` wrapper, add:

```svelte
<div class="my-5 flex items-center gap-3 text-[13px] text-grey-2">
	<span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span>
</div>
<OAuthButtons />
```

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/signup/+page.svelte
git commit -m "feat: add Google sign-in to signup page (#5)"
```

---

## Task 4: Validate with the Svelte autofixer

**Files:** (no changes unless the autofixer flags issues)

- [ ] **Step 1: Run the Svelte MCP autofixer on the new component**

Use the `svelte-autofixer` MCP tool on the contents of `src/lib/components/OAuthButtons.svelte`. Apply any fixes it returns, then re-run it until it reports no issues.

- [ ] **Step 2: If the autofixer changed the file, re-run tests**

Run: `bun run test:unit -- --run src/lib/components/OAuthButtons.svelte.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit only if the file changed**

```bash
git add src/lib/components/OAuthButtons.svelte
git commit -m "style: apply svelte autofixer to OAuthButtons (#5)"
```

---

## Task 5: Full check and lint

- [ ] **Step 1: Run the unit test suite**

Run: `bun run test:unit -- --run`
Expected: all tests PASS.

- [ ] **Step 2: Type-check and lint**

Run: `bun run check && bun run lint`
Expected: 0 type errors; prettier and eslint clean. If prettier complains, run `bun run format`, then re-stage and amend the relevant commit.

---

## Task 6: Manual OAuth round-trip verification

> Cannot be unit-tested — exercises the real Google provider and the `/api/auth` proxy redirect rewriting.

- [ ] **Step 1: Verify on the production (registered) origin — NOT a Preview**

The OAuth round-trip cannot be verified on a Vercel Preview deployment. The
`/api/auth` proxy pins the Origin it sends to Neon to a single registered value
(`NEON_AUTH_ORIGIN`), and that value is the production URL for every environment
(preview included). So Neon completes the OAuth redirect against the production
origin and sets the session cookie first-party on the production host; the
preview host never receives a session and its auth guard blocks `/agenda`.
(Email/password works on previews only because it never leaves the origin.)

Verify on the production deployment, whose origin is the one registered in Neon's
trusted origins:

1. Open `/login` on production, click "Continue with Google".
2. Complete the Google consent screen.
3. Confirm the callback resolves through `/api/auth` and lands an authenticated session on `/agenda`.
4. Repeat from `/signup`.

- [ ] **Step 2: Confirm and close**

If the round-trip works on both pages, the Google half of #5 is complete. Close issue #5 (Microsoft is out of scope and not tracked, per the design).

---

## Self-Review notes

- **Spec coverage:** OAuthButtons component (Task 1) ✓; secondary button style + below-form "or" divider layout (Tasks 1–3) ✓; self-contained error alert reusing the `role="alert"` / `text-danger` pattern (Task 1) ✓; `callbackURL` default `/agenda` (Task 1) ✓; both pages wired (Tasks 2–3) ✓; no auth-client/proxy changes (none in plan) ✓; component tests for the three behaviors (Task 1) ✓; manual round-trip (Task 6) ✓; Microsoft out of scope, close #5 (Task 6) ✓.
- **Type consistency:** handler `google()`, `callbackURL` prop, `error`/`isRedirecting` state, and `fallback` message are named identically across all steps that reference them.
