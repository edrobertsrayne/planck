# Google OAuth login — design

**Issue:** #5 (Add Google OAuth login; Microsoft deferred — unavailable on Neon Auth)
**Date:** 2026-06-17

## Goal

Let users sign in / sign up with Google from the existing login and signup
pages, in addition to email + password.

## Scope

- **In:** "Continue with Google" on `/login` and `/signup`, routed through the
  existing Neon Auth proxy.
- **Out:** Microsoft OAuth. Neon Auth does not offer Microsoft, so it cannot be
  built now. No follow-up issue is being opened; #5 closes once Google ships.

## Background (current state)

- Auth runs through the Neon Auth better-auth client (`@neondatabase/auth`),
  exposed browser-only via a lazy Proxy in `src/lib/auth-client.ts`.
- `/login` and `/signup` currently wire only `authClient.signIn.email(...)` /
  `authClient.signUp.email(...)`, redirecting to `/agenda` on success.
- The client already exposes `signIn.social({ provider, callbackURL })`, and the
  same-origin proxy at `src/routes/api/auth/[...path]/+server.ts` already
  rewrites upstream `Location` redirects back through `/api/auth`. The OAuth
  redirect round-trip is therefore supported with **no client or proxy changes**.

## Design

### New component — `src/lib/components/OAuthButtons.svelte`

Single source for the Google button, its handler, and its error display.
Self-contained so both pages reuse it without duplication.

Props:

```ts
let { callbackURL = '/agenda' }: { callbackURL?: string } = $props();
```

Behaviour:

- Internal `isRedirecting` state disables the button while the social call is in
  flight.
- Internal `error` state, rendered beneath the button as
  `{#if error}<p role="alert" class="text-sm text-danger">{error}</p>{/if}` —
  the same alert pattern the forms already use, kept next to the button that
  triggers it (the button sits below the email form, so a shared form-level
  alert would render too far away).
- Click handler:

  ```ts
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
  ```

  `fallback = 'Unable to continue with Google. Please try again.'`. This mirrors
  the existing email handlers' try/catch + fallback shape. Richer per-error-code
  messaging is deferred to issue #9.

- The Google "G" is an inline multicolor brand SVG inside this component. It is
  **not** added to `src/lib/components/icons.ts`, which holds monochrome
  single-stroke UI glyphs, not brand logos.

### Styling & layout

- Button uses the existing **secondary** style
  (`border border-line bg-white text-grey-1 hover:border-pink-200`), so it reads
  as secondary to the pink primary CTA. Full width, height matching the existing
  primary button, logo + "Continue with Google" label.
- Placed **below** the email/password form, separated by an "or" divider
  (`—— or ——` using `line` / `grey-2` tokens). Identical on both pages.

```
[ email/password form + primary submit button ]
———————— or ————————
[ Continue with Google ]
{#if error}<p role="alert">…</p>{/if}   ← inside OAuthButtons
```

### Wiring

- `src/routes/login/+page.svelte`: import and render `<OAuthButtons />` below the
  form (default `callbackURL` of `/agenda`).
- `src/routes/signup/+page.svelte`: same.
- No changes to `src/lib/auth-client.ts` or
  `src/routes/api/auth/[...path]/+server.ts`.

## Testing

### Automated — `src/lib/components/OAuthButtons.svelte.test.ts`

Using `vitest-browser-svelte` (the established `*.svelte.test.ts` pattern) with
`vi.mock('$lib/auth-client')` to stub `authClient.signIn.social`:

1. Click → `signIn.social` called once with
   `{ provider: 'google', callbackURL: '/agenda' }`.
2. Resolved `{ error: { message } }` → that message renders in the
   `role="alert"` element.
3. Thrown error → the fallback message renders.

### Manual verification (cannot be unit-tested — real OAuth)

Click "Continue with Google" → Google consent → callback resolves through
`/api/auth` → authenticated session lands on `/agenda`. Verify on a deployed
Preview (Neon Auth Google provider is enabled there per the issue owner).

## Out of scope / follow-ups

- Microsoft OAuth (blocked by Neon Auth; not tracked).
- Richer OAuth error-code messaging — issue #9.
- Signup-form structure changes — issues #10, #11. OAuth lands below the form,
  so conflict surface with those is small.
