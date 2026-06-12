# Frontend Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing planck app with a token-driven "Bloom" design system — clean white background, pink-led pastel palette, Fraunces titles + Inter body, top-bar + rail shell — touching markup/CSS only, never load functions, form actions, or `src/lib/scheduling/*`.

**Architecture:** Tailwind v4 `@theme` tokens in `src/routes/layout.css` define colours/fonts/radii. A small set of reusable Svelte 5 (runes) components in `src/lib/components/` encapsulate buttons, fields, chips, cards, headers, empty states, and the colour-dot. Every page is restyled to compose these, preserving all existing data flow, form `action`s, field `name`s, accessible names, and DOM structure that tests depend on.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Tailwind CSS v4, `@fontsource-variable/inter`, `@fontsource-variable/fraunces`, Vitest (vitest-browser-svelte), bun.

---

## Cross-Cutting Rules (apply to EVERY task)

These are invariants. Breaking one is a bug even if the page "looks right".

1. **Never touch** `+page.server.ts`, `+layout.server.ts`, `hooks.server.ts`, `src/lib/server/**`, or `src/lib/scheduling/**`. This is a presentation-only pass.
2. **Preserve form contracts:** keep every `<form method="POST" action="...">`, every input/select `name=`, and every hidden field exactly as-is. Only restyle wrappers/classes.
3. **Buttons in forms must submit.** The new `<Button>` defaults to `type="button"`. Any button that previously submitted a form (all the existing `<button>`s inside `<form>`) MUST be rendered with `type="submit"`. Verify by exercising the form in `bun run dev`.
4. **Preserve accessible names & text** that tests/screen-readers use. Specifically keep these visible strings/attrs unchanged:
   - Placeholders: `Name`, `Email`, `Password`, `Autumn 1`, `GCSE Chemistry`, `10Phy1`, `Forces`, `L1: Intro to forces`.
   - Button text: `Sign in`, `Sign up`, `Save`, `Add block`, `Add closure`, `Add course`, `Add class`, `Add module`, `Add lesson`, `Assign`, `Move`, `Delete`.
   - `aria-label="Move up"` / `aria-label="Move down"` on the reorder buttons.
   - Input/select names: `startDate`, `endDate`, `date`, `classId`, `courseId`, `room`, `colour`, `name`, `title`, `cycleWeeks`, `periodsPerDay`, `anchorLetter`, `teachingDays`, `weekLetter`, `dayOfWeek`, `period`, `id`, `orderedIds`.
   - Agenda lesson text must still render `{courseName} — {title}` (e2e asserts `Forces — L1 Intro`) and the class name (`10Phy1`).
   - Timetable must keep a `<tbody>` whose first `<tr>`'s first `<td>` is Monday/P1 and contains `select[name="classId"]` (e2e: `page.locator('tbody tr').first().locator('td').first()`).
   - Module assign success text must still contain `Scheduled {n} lessons`.
5. **Svelte:** per `CLAUDE.md`, run the Svelte MCP `svelte-autofixer` on each new/edited `.svelte` file until it returns no issues, before committing the task.
6. **Per-task verification gate** (run before each commit):
   - `bun run check` → 0 errors.
   - `bun run lint` → passes (run `bun run format` first if needed).
   - `bun run test:unit -- --run` → all green (scheduling specs + any component specs).

---

## File Structure

**Created:**
- `src/lib/components/Button.svelte` — variant/size button.
- `src/lib/components/Chip.svelte` — pill (week letter / status / neutral).
- `src/lib/components/Card.svelte` — hairline container, optional hover lift.
- `src/lib/components/PageHeader.svelte` — Fraunces title + optional subtitle + actions slot.
- `src/lib/components/EmptyState.svelte` — icon + message for empty lists.
- `src/lib/components/Field.svelte` — label wrapper for an input/select (uses a snippet child).
- `src/lib/components/SubjectDot.svelte` — solid colour dot/bar from a hex colour.
- `src/lib/colour.ts` — `withAlpha(hex, alpha)` helper for faint cell tints.
- `src/lib/colour.spec.ts` — unit tests for `withAlpha`.
- `src/lib/components/Button.svelte.test.ts` — browser test for variant classes + submit type.

**Modified:**
- `src/routes/layout.css` — add `@theme` tokens + base layer.
- `src/routes/+layout.svelte` — import fonts.
- `src/routes/(app)/+layout.svelte` — top-bar + rail shell.
- All page components under `src/routes/(app)/**` and `src/routes/login`, `src/routes/signup`.

---

## Task 1: Design tokens & fonts

**Files:**
- Modify: `src/routes/layout.css`
- Modify: `src/routes/+layout.svelte`
- Add deps: `@fontsource-variable/inter`, `@fontsource-variable/fraunces`

- [ ] **Step 1: Install the font packages**

Run:
```bash
bun add -d @fontsource-variable/inter @fontsource-variable/fraunces
```
Expected: both packages added to `devDependencies`.

- [ ] **Step 2: Import fonts in the root layout**

Edit `src/routes/+layout.svelte` — add the two font imports at the top of the existing `<script>` block (keep everything else):

```svelte
<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/fraunces';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>
```

- [ ] **Step 3: Write the token theme**

Replace the entire contents of `src/routes/layout.css` with:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/forms';
@plugin '@tailwindcss/typography';

@theme {
	--font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
	--font-display: 'Fraunces Variable', ui-serif, Georgia, serif;

	--color-pink: #e8488b;
	--color-pink-hover: #d83d80;
	--color-pink-dk: #a21d6b;
	--color-pink-50: #fdf2f8;
	--color-pink-100: #fce7f3;
	--color-pink-200: #fbcfe8;

	--color-ink: #3a2f35;
	--color-muted: #a89aa1;
	--color-line: #f1e8ec;
	--color-field: #f7f4f6;
	--color-danger: #c2476b;

	--radius-control: 0.625rem; /* 10px */
	--radius-card: 0.875rem; /* 14px */
}

@layer base {
	html {
		background: #fff;
		color: var(--color-ink);
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
	}
}
```

- [ ] **Step 4: Verify tokens compile and render**

Run: `bun run dev` and open the app. Expected: text now renders in Inter; no build errors in the terminal. Run `bun run check` → 0 errors. Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/routes/layout.css src/routes/+layout.svelte
git commit -m "feat(design): add Bloom design tokens and self-hosted fonts"
```

---

## Task 2: Colour helper + unit test

**Files:**
- Create: `src/lib/colour.ts`
- Test: `src/lib/colour.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/colour.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withAlpha } from './colour';

describe('withAlpha', () => {
	it('appends a two-digit alpha to a 6-digit hex', () => {
		expect(withAlpha('#ff0000', 0.5)).toBe('#ff000080');
	});

	it('clamps alpha to the 0–1 range', () => {
		expect(withAlpha('#abcdef', 2)).toBe('#abcdefff');
		expect(withAlpha('#abcdef', -1)).toBe('#abcdef00');
	});

	it('returns the input unchanged when it is not a 6-digit hex', () => {
		expect(withAlpha('red', 0.5)).toBe('red');
		expect(withAlpha('#fff', 0.5)).toBe('#fff');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/colour.spec.ts`
Expected: FAIL — cannot find module `./colour`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/colour.ts`:

```ts
/**
 * Append an alpha channel to a 6-digit hex colour, e.g. withAlpha('#ff0000', 0.5) -> '#ff000080'.
 * Non 6-digit-hex inputs are returned unchanged so caller styles degrade gracefully.
 */
export function withAlpha(hex: string, alpha: number): string {
	if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
	const clamped = Math.max(0, Math.min(1, alpha));
	const a = Math.round(clamped * 255)
		.toString(16)
		.padStart(2, '0');
	return `${hex}${a}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/colour.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/colour.ts src/lib/colour.spec.ts
git commit -m "feat(design): add withAlpha colour helper"
```

---

## Task 3: Button component (with test)

**Files:**
- Create: `src/lib/components/Button.svelte`
- Test: `src/lib/components/Button.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/Button.svelte.test.ts`:

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import Button from './Button.svelte';

test('renders primary variant by default with pink background', async () => {
	const screen = render(Button, { children: () => 'Save' as unknown as never });
	const btn = screen.getByRole('button', { name: 'Save' });
	await expect.element(btn).toBeInTheDocument();
	await expect.element(btn).toHaveClass(/bg-pink/);
});

test('passes through the submit type so it can submit forms', async () => {
	const screen = render(Button, {
		type: 'submit',
		children: () => 'Add' as unknown as never
	});
	const btn = screen.getByRole('button', { name: 'Add' });
	await expect.element(btn).toHaveAttribute('type', 'submit');
});
```

> Note: `children` is passed as a snippet-returning function for the test harness; the runtime usage is normal `{#snippet}`/slot children in `.svelte` files.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/Button.svelte.test.ts`
Expected: FAIL — cannot find `./Button.svelte`.

- [ ] **Step 3: Implement the Button**

Create `src/lib/components/Button.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
	type Size = 'md' | 'sm';

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: klass = '',
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		class?: string;
		children?: Snippet;
	} & HTMLButtonAttributes = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-100';
	const sizes: Record<Size, string> = {
		md: 'px-4 py-2 text-sm',
		sm: 'px-3 py-1.5 text-xs'
	};
	const variants: Record<Variant, string> = {
		primary: 'border-transparent bg-pink text-white hover:bg-pink-hover',
		secondary: 'border-pink-200 bg-white text-pink-dk hover:bg-pink-50',
		ghost: 'border-transparent bg-transparent text-ink/70 hover:bg-field',
		danger: 'border-pink-200/60 bg-transparent text-danger hover:bg-pink-50'
	};
</script>

<button {type} class={`${base} ${sizes[size]} ${variants[variant]} ${klass}`} {...rest}>
	{@render children?.()}
</button>
```

- [ ] **Step 4: Run autofixer, then the test**

Run the Svelte MCP `svelte-autofixer` on `Button.svelte` until clean. Then:
Run: `bun run test:unit -- --run src/lib/components/Button.svelte.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Button.svelte src/lib/components/Button.svelte.test.ts
git commit -m "feat(design): add Button component"
```

---

## Task 4: Presentational components (Chip, Card, PageHeader, EmptyState, Field, SubjectDot)

These are static-markup components; they're verified via `svelte-autofixer` + `bun run check` + visual use in later tasks (no dedicated browser tests — YAGNI for pure markup).

**Files:**
- Create: `src/lib/components/Chip.svelte`
- Create: `src/lib/components/Card.svelte`
- Create: `src/lib/components/PageHeader.svelte`
- Create: `src/lib/components/EmptyState.svelte`
- Create: `src/lib/components/Field.svelte`
- Create: `src/lib/components/SubjectDot.svelte`

- [ ] **Step 1: Chip**

Create `src/lib/components/Chip.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'pink' | 'neutral' | 'success';

	let { tone = 'pink', children }: { tone?: Tone; children?: Snippet } = $props();

	const tones: Record<Tone, string> = {
		pink: 'bg-pink-100 text-pink-dk',
		neutral: 'bg-field text-muted',
		success: 'bg-[#e8f5ee] text-[#2f7d56]'
	};
</script>

<span
	class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
>
	{@render children?.()}
</span>
```

- [ ] **Step 2: Card**

Create `src/lib/components/Card.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		hover = false,
		class: klass = '',
		children
	}: { hover?: boolean; class?: string; children?: Snippet } = $props();
</script>

<div
	class={`rounded-card border border-line bg-white p-4 ${hover ? 'transition hover:border-pink-200 hover:shadow-[0_3px_12px_rgba(80,20,50,0.07)]' : ''} ${klass}`}
>
	{@render children?.()}
</div>
```

- [ ] **Step 3: PageHeader**

Create `src/lib/components/PageHeader.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		actions,
		meta
	}: { title: string; subtitle?: string; actions?: Snippet; meta?: Snippet } = $props();
</script>

<header class="mb-6">
	<div class="flex flex-wrap items-baseline gap-3">
		<h1 class="font-display text-3xl font-semibold tracking-tight">{title}</h1>
		{@render meta?.()}
		{#if actions}<div class="ml-auto flex items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{#if subtitle}<p class="mt-1 text-sm text-muted">{subtitle}</p>{/if}
</header>
```

- [ ] **Step 4: EmptyState**

Create `src/lib/components/EmptyState.svelte`:

```svelte
<script lang="ts">
	let { message }: { message: string } = $props();
</script>

<div class="rounded-card border border-dashed border-line bg-field/40 px-6 py-10 text-center">
	<svg
		class="mx-auto mb-3 text-pink-200"
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		<rect x="3" y="4" width="18" height="17" rx="2" />
		<path d="M3 9h18M8 2v4M16 2v4" />
	</svg>
	<p class="text-sm text-muted">{message}</p>
</div>
```

- [ ] **Step 5: Field**

Create `src/lib/components/Field.svelte` (a label wrapper; the control is passed as children so existing `name=`/inputs are preserved verbatim by callers):

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { label, children }: { label: string; children?: Snippet } = $props();
</script>

<label class="flex flex-col gap-1.5 text-sm font-medium text-ink">
	{label}
	{@render children?.()}
</label>
```

- [ ] **Step 6: SubjectDot**

Create `src/lib/components/SubjectDot.svelte`:

```svelte
<script lang="ts">
	let {
		colour,
		shape = 'dot'
	}: { colour: string; shape?: 'dot' | 'bar' } = $props();
</script>

{#if shape === 'bar'}
	<span class="w-1 self-stretch rounded" style="background:{colour}" aria-hidden="true"></span>
{:else}
	<span
		class="inline-block h-3.5 w-3.5 shrink-0 rounded"
		style="background:{colour}"
		aria-hidden="true"
	></span>
{/if}
```

- [ ] **Step 7: Autofix and verify**

Run `svelte-autofixer` on each of the six components until clean. Then `bun run check` → 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/Chip.svelte src/lib/components/Card.svelte src/lib/components/PageHeader.svelte src/lib/components/EmptyState.svelte src/lib/components/Field.svelte src/lib/components/SubjectDot.svelte
git commit -m "feat(design): add Chip, Card, PageHeader, EmptyState, Field, SubjectDot"
```

---

## Task 5: App shell — top-bar + rail

**Files:**
- Modify: `src/routes/(app)/+layout.svelte`

Keeps the existing `links` array, `page` active logic, and `signOut()`. Restructures layout to a global top bar + nav rail. Sign-out lives in a native `<details>` account menu (no extra JS/state).

- [ ] **Step 1: Replace the shell**

Replace the entire contents of `src/routes/(app)/+layout.svelte` with:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Button from '$lib/components/Button.svelte';

	let { children } = $props();

	const links = [
		{ href: '/agenda', label: 'Agenda' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/courses', label: 'Courses' },
		{ href: '/classes', label: 'Classes' },
		{ href: '/timetable', label: 'Timetable' },
		{ href: '/settings', label: 'Settings' }
	];

	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

{#snippet icon(href: string)}
	<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		{#if href === '/agenda'}
			<rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" />
		{:else if href === '/calendar'}
			<rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18" />
		{:else if href === '/courses'}
			<path d="M4 5v14l8-3 8 3V5l-8 3-8-3z" />
		{:else if href === '/classes'}
			<circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6" />
		{:else if href === '/timetable'}
			<rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" />
		{:else}
			<circle cx="12" cy="12" r="3" /><path
				d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.6c.06-.33.1-.66.1-1z"
			/>
		{/if}
	</svg>
{/snippet}

<div class="flex min-h-screen flex-col">
	<header class="flex items-center gap-4 border-b border-line px-6 py-3">
		<a href="/agenda" class="font-display text-2xl font-bold tracking-tight text-pink-dk">planck</a>
		<div
			class="ml-1 hidden max-w-md flex-1 items-center gap-2 rounded-control border border-line bg-field px-3 py-2 text-sm text-muted md:flex"
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
				<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
			</svg>
			Search lessons, classes, courses…
		</div>
		<details class="relative ml-auto">
			<summary
				class="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-gradient-to-br from-pink-200 to-pink ring-1 ring-line"
				aria-label="Account"
			></summary>
			<div
				class="absolute right-0 z-10 mt-2 w-40 rounded-control border border-line bg-white p-1 shadow-[0_8px_24px_rgba(80,20,50,0.12)]"
			>
				<Button variant="ghost" class="w-full justify-start" onclick={signOut}>Sign out</Button>
			</div>
		</details>
	</header>

	<div class="flex flex-1">
		<nav class="flex w-52 flex-col gap-1 border-r border-line p-3">
			{#each links as link (link.href)}
				{@const active = page.url.pathname.startsWith(link.href)}
				<a
					href={link.href}
					class="flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition"
					class:bg-pink-100={active}
					class:text-pink-dk={active}
					class:font-semibold={active}
					class:text-ink={!active}
					class:hover:bg-field={!active}
				>
					<span class={active ? 'text-pink' : 'text-muted'}>{@render icon(link.href)}</span>
					{link.label}
				</a>
			{/each}
		</nav>
		<main class="flex-1 p-8">
			{@render children()}
		</main>
	</div>
</div>
```

- [ ] **Step 2: Autofix**

Run `svelte-autofixer` on `(app)/+layout.svelte` until clean.

- [ ] **Step 3: Verify shell + sign-out**

Run `bun run dev`, sign in (or visit `/agenda`). Confirm: top bar with wordmark + search pill + avatar; rail with active pill on the current page; clicking the avatar reveals **Sign out**, which logs out and redirects to `/login`. Run `bun run check` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/+layout.svelte"
git commit -m "feat(design): top-bar + rail app shell"
```

---

## Task 6: Agenda page

**Files:**
- Modify: `src/routes/(app)/agenda/+page.svelte`

Preserve: `data.groups`, `g.date`/`g.weekLetter`/`g.items`, item fields, the two forms (`/agenda?/moveLesson`, `/agenda?/deleteLesson`) with names `id`/`date`/`period`, `moveError`, and the `{courseName} — {title}` text.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/routes/(app)/agenda/+page.svelte` with:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';

	let { data, form } = $props<{
		data: import('./$types').PageData;
		form: { moveError?: string } | null;
	}>();

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<PageHeader title="Agenda" subtitle="Your upcoming lessons, grouped by day." />

{#if form?.moveError}<p class="mb-3 text-sm text-danger">{form.moveError}</p>{/if}

{#if data.groups.length === 0}
	<EmptyState message="No upcoming lessons. Assign a module to a class to fill your agenda." />
{/if}

{#each data.groups as g (g.date)}
	<section class="mb-6">
		<h2 class="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-ink/80">
			{label(g.date)}
			{#if g.weekLetter}<span class="text-xs font-normal text-muted">· Week {g.weekLetter}</span>{/if}
		</h2>
		<div class="flex flex-col gap-2">
			{#each g.items as item (item.id)}
				<div
					class="group flex items-center gap-3.5 rounded-card border border-line bg-white px-4 py-3 text-sm transition hover:border-pink-200 hover:shadow-[0_3px_12px_rgba(80,20,50,0.07)]"
				>
					<span class="w-6 font-bold text-muted">P{item.period}</span>
					<SubjectDot colour={item.colour} shape="bar" />
					<span class="w-16 font-bold">{item.className}</span>
					<span class="flex-1 text-ink/80">{item.courseName} — {item.title}</span>
					<span class="rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-muted"
						>{item.room}</span
					>
					<div class="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
						<form
							method="POST"
							action="/agenda?/moveLesson"
							use:enhance
							class="flex items-center gap-1"
						>
							<input type="hidden" name="id" value={item.id} />
							<input
								type="date"
								name="date"
								required
								class="rounded-control border border-line bg-field px-2 py-1 text-xs"
							/>
							<input
								type="number"
								name="period"
								min="1"
								placeholder="P"
								required
								class="w-12 rounded-control border border-line bg-field px-2 py-1 text-xs"
							/>
							<Button type="submit" variant="secondary" size="sm">Move</Button>
						</form>
						<form method="POST" action="/agenda?/deleteLesson" use:enhance>
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="danger" size="sm">Delete</Button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/each}
```

- [ ] **Step 2: Autofix + verify**

Run `svelte-autofixer` until clean. Run `bun run dev`, open `/agenda`: confirm lesson rows render, the Move form (date + period + Move) submits, and Delete works. Run `bun run check`.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/agenda/+page.svelte"
git commit -m "feat(design): restyle agenda page"
```

---

## Task 7: Calendar page

**Files:**
- Modify: `src/routes/(app)/calendar/+page.svelte`

Preserve all `data` usage and the `?start=` prev/next links. Apply the roomier grid (taller cells, stacked class → title → room, quiet dot for empty), faint subject tint via `withAlpha`.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/routes/(app)/calendar/+page.svelte` with:

```svelte
<script lang="ts">
	import { addDays } from '$lib/scheduling/dates';
	import { withAlpha } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Chip from '$lib/components/Chip.svelte';
	import Button from '$lib/components/Button.svelte';
	let { data } = $props();

	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) =>
			data.config.teachingDays.includes(d.n as import('$lib/scheduling/dates').DayOfWeek)
		)
	);
	const periods = $derived(Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1));

	function dateFor(dayN: number): string {
		return addDays(data.weekStart, dayN - 1);
	}
	function cell(dayN: number, period: number) {
		const date = dateFor(dayN);
		return data.lessons.find((l) => l.date === date && l.period === period);
	}
	const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
	function fmt(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<PageHeader title="Calendar">
	{#snippet meta()}
		{#if data.weekLetter}<Chip>Week {data.weekLetter}</Chip>{/if}
	{/snippet}
	{#snippet actions()}
		<Button variant="secondary" size="sm" href="?start={data.prevStart}">← Prev</Button>
		<Button variant="secondary" size="sm" href="?start={data.nextStart}">Next →</Button>
	{/snippet}
</PageHeader>

<div class="overflow-hidden rounded-card border border-line">
	<table class="w-full border-collapse text-sm">
		<thead>
			<tr>
				<th class="w-12 border-b border-line bg-field p-3"></th>
				{#each days as d (d.n)}
					<th class="border-b border-l border-line bg-field p-3 text-xs font-bold text-ink/70">
						{d.label}<br /><span class="font-normal text-muted">{fmt(dateFor(d.n))}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each periods as p (p)}
				<tr>
					<th class="border-b border-line bg-field p-3 text-xs font-bold text-muted">P{p}</th>
					{#each days as d (d.n)}
						{@const l = cell(d.n, p)}
						<td class="h-20 border-b border-l border-line p-1.5 align-top">
							{#if l}
								<div
									class="flex h-full flex-col gap-1.5 rounded-lg p-2.5"
									style="background:{withAlpha(l.colour, 0.16)}"
								>
									<div class="text-xs font-bold">{l.className}</div>
									<div class="text-[11px] leading-tight text-ink/75">{l.title}</div>
									<div class="mt-auto text-[10px] font-semibold text-muted">{l.room}</div>
								</div>
							{:else}
								<div class="pt-6 text-center text-pink-200">·</div>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

> `withAlpha(l.colour, 0.16)` requires `l.colour` to be a 6-digit hex (the seeded/stored format). Non-hex values fall through unchanged per the helper contract.

- [ ] **Step 2: Autofix + verify**

Run `svelte-autofixer` until clean. `bun run dev` → `/calendar`: roomier cells, prev/next still navigate. Run `bun run check`.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/calendar/+page.svelte"
git commit -m "feat(design): restyle calendar grid with breathing room"
```

---

## Task 8: Timetable page

**Files:**
- Modify: `src/routes/(app)/timetable/+page.svelte`

CRITICAL: keep `<tbody>` → first `<tr>` → first `<td>` containing `select[name="classId"]` (e2e depends on it). Keep `input[name="room"]`, hidden `weekLetter`/`dayOfWeek`/`period`, the `requestSubmit()` handlers, and the Week A/B toggle.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/routes/(app)/timetable/+page.svelte` with:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { withAlpha } from '$lib/colour';
	import PageHeader from '$lib/components/PageHeader.svelte';
	let { data } = $props();

	let week = $state<'A' | 'B'>('A');
	const days = $derived(
		[
			{ n: 1, label: 'Mon' },
			{ n: 2, label: 'Tue' },
			{ n: 3, label: 'Wed' },
			{ n: 4, label: 'Thu' },
			{ n: 5, label: 'Fri' }
		].filter((d) =>
			data.config.teachingDays.includes(d.n as (typeof data.config.teachingDays)[number])
		)
	);
	const periods = $derived(Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1));

	function slotFor(dayOfWeek: number, period: number) {
		return data.slots.find(
			(s) => s.weekLetter === week && s.dayOfWeek === dayOfWeek && s.period === period
		);
	}
	function classById(id: number) {
		return data.classes.find((c) => c.id === id);
	}
</script>

<PageHeader title="Timetable" subtitle={'Pick a class to assign a cell; choose "— free —" to clear it.'} />

{#if data.config.cycleWeeks === 2}
	<div class="mb-4 inline-flex gap-1 rounded-control border border-line bg-field p-1">
		<button
			class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
			class:bg-white={week === 'A'}
			class:text-pink-dk={week === 'A'}
			class:text-muted={week !== 'A'}
			onclick={() => (week = 'A')}
		>
			Week A
		</button>
		<button
			class="rounded-md px-4 py-1.5 text-sm font-semibold transition"
			class:bg-white={week === 'B'}
			class:text-pink-dk={week === 'B'}
			class:text-muted={week !== 'B'}
			onclick={() => (week = 'B')}
		>
			Week B
		</button>
	</div>
{/if}

<div class="overflow-hidden rounded-card border border-line">
	<table class="border-collapse text-sm">
		<thead>
			<tr>
				<th class="border-b border-line bg-field p-3"></th>
				{#each days as d (d.n)}
					<th class="border-b border-l border-line bg-field p-3 text-xs font-bold text-ink/70"
						>{d.label}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each periods as p (p)}
				<tr>
					<th class="border-b border-line bg-field p-3 text-xs font-bold text-muted">P{p}</th>
					{#each days as d (d.n)}
						{@const slot = slotFor(d.n, p)}
						{@const cls = slot ? classById(slot.classId) : undefined}
						<td class="border-b border-l border-line p-1.5 align-top">
							<form method="POST" action="?/set" use:enhance class="flex flex-col gap-1.5">
								<input type="hidden" name="weekLetter" value={week} />
								<input type="hidden" name="dayOfWeek" value={d.n} />
								<input type="hidden" name="period" value={p} />
								<select
									name="classId"
									class="w-28 rounded-control border border-line text-sm"
									style={cls ? `background:${withAlpha(cls.colour, 0.16)}` : ''}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									<option value="0">— free —</option>
									{#each data.classes as c (c.id)}
										<option value={c.id} selected={slot?.classId === c.id}>{c.name}</option>
									{/each}
								</select>
								<input
									name="room"
									placeholder="Room"
									value={slot?.room ?? ''}
									class="w-28 rounded-control border border-line bg-field text-sm"
									onblur={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</form>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
```

- [ ] **Step 2: Autofix + verify**

Run `svelte-autofixer` until clean. `bun run dev` → `/timetable`: assigning a class to Mon/P1 still submits and persists; Week A/B toggle works. Run `bun run check`.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/timetable/+page.svelte"
git commit -m "feat(design): restyle timetable grid"
```

---

## Task 9: Courses, course detail, module pages

**Files:**
- Modify: `src/routes/(app)/courses/+page.svelte`
- Modify: `src/routes/(app)/courses/[courseId]/+page.svelte`
- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`

- [ ] **Step 1: Courses list**

Replace the entire contents of `src/routes/(app)/courses/+page.svelte` with:

```svelte
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';
	let { data } = $props();
</script>

<PageHeader title="Courses" subtitle="Your subjects and their schemes of work." />

{#if data.courses.length === 0}
	<EmptyState message="No courses yet. Add your first below." />
{:else}
	<ul class="mb-6 flex flex-col gap-2">
		{#each data.courses as c (c.id)}
			<li class="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
				<SubjectDot colour={c.colour} />
				<a class="font-semibold text-ink hover:text-pink-dk hover:underline" href="/courses/{c.id}"
					>{c.name}</a
				>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card>
	<form method="POST" action="?/create" class="flex flex-wrap items-end gap-3">
		<input
			name="name"
			placeholder="GCSE Chemistry"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<input name="colour" type="color" value="#3884ff" class="h-9 w-12 rounded-control border border-line" />
		<Button type="submit">Add course</Button>
	</form>
</Card>
```

- [ ] **Step 2: Course detail**

Replace the entire contents of `src/routes/(app)/courses/[courseId]/+page.svelte` with:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	let { data } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.modules.map((m) => m.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses" class="text-sm font-medium text-pink-dk hover:underline">← Courses</a>
<PageHeader title={data.course.name} />

{#if data.modules.length === 0}
	<EmptyState message="No modules yet. Add the first one below." />
{:else}
	<ul class="mb-6 flex flex-col gap-1.5">
		{#each data.modules as m, i (m.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
					<button class="px-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label="Move up">↑</button>
				</form>
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
					<button
						class="px-1 text-muted hover:text-ink disabled:opacity-30"
						disabled={i === data.modules.length - 1}
						aria-label="Move down">↓</button
					>
				</form>
				<a
					class="font-semibold text-ink hover:text-pink-dk hover:underline"
					href="/courses/{data.course.id}/modules/{m.id}">{m.name}</a
				>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={m.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card>
	<form method="POST" action="?/create" class="flex items-end gap-3">
		<input
			name="name"
			placeholder="Forces"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<Button type="submit">Add module</Button>
	</form>
</Card>
```

- [ ] **Step 3: Module page**

Replace the entire contents of `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte` with:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	let { data, form } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.lessons.map((l) => l.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses/{data.module.courseId}" class="text-sm font-medium text-pink-dk hover:underline"
	>← Modules</a
>
<PageHeader title={data.module.name} />

{#if data.lessons.length === 0}
	<EmptyState message="No lessons in this module yet." />
{:else}
	<ul class="mb-6 flex flex-col gap-1.5">
		{#each data.lessons as l, i (l.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
					<button class="px-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} aria-label="Move up">↑</button>
				</form>
				<form method="POST" action="?/reorder" use:enhance>
					<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
					<button
						class="px-1 text-muted hover:text-ink disabled:opacity-30"
						disabled={i === data.lessons.length - 1}
						aria-label="Move down">↓</button
					>
				</form>
				<span class="text-ink"><span class="font-semibold text-muted">{i + 1}.</span> {l.title}</span>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={l.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<Card class="mb-8">
	<form method="POST" action="?/create" class="flex items-end gap-3">
		<input
			name="title"
			placeholder="L1: Intro to forces"
			required
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
		<Button type="submit">Add lesson</Button>
	</form>
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Schedule this module</h2>
	{#if data.classes.length === 0}
		<p class="text-sm text-muted">No classes study this course yet. Create one under Classes.</p>
	{:else}
		<form method="POST" action="?/assign" use:enhance class="flex items-end gap-3">
			<Field label="Class">
				<select name="classId" class="rounded-control border border-line bg-field px-3 py-2 text-sm">
					{#each data.classes as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</Field>
			<Button type="submit">Assign</Button>
		</form>
	{/if}

	{#if form?.assigned}
		<p class="mt-3 text-sm text-[#2f7d56]">
			Scheduled {form.assigned.scheduled} lessons
			{#if form.assigned.firstDate}({form.assigned.firstDate} → {form.assigned.lastDate}){/if}.
			{#if form.assigned.unscheduled > 0}
				{form.assigned.unscheduled} did not fit before the end of your teaching blocks.
			{/if}
		</p>
	{/if}
	{#if form?.assignError}
		<p class="mt-3 text-sm text-danger">{form.assignError}</p>
	{/if}
</Card>
```

- [ ] **Step 4: Autofix + verify**

Run `svelte-autofixer` on all three until clean. `bun run dev`: add a course, open it, add a module, open it, add a lesson, reorder (↑/↓), and Assign — all still work. Run `bun run check`.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/courses/+page.svelte" "src/routes/(app)/courses/[courseId]/+page.svelte" "src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte"
git commit -m "feat(design): restyle courses, course detail, module pages"
```

---

## Task 10: Classes page

**Files:**
- Modify: `src/routes/(app)/classes/+page.svelte`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/routes/(app)/classes/+page.svelte` with:

```svelte
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';
	let { data } = $props();
</script>

<PageHeader title="Classes" subtitle="Teaching groups, each linked to a course." />

{#if data.classes.length === 0}
	<EmptyState message="No classes yet." />
{:else}
	<ul class="mb-6 flex flex-col gap-2">
		{#each data.classes as c (c.id)}
			<li class="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
				<SubjectDot colour={c.colour} />
				<span class="font-semibold text-ink">{c.name}</span>
				<span class="text-sm text-muted">{c.courseName}</span>
				<form method="POST" action="?/delete" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

{#if data.courses.length === 0}
	<p class="text-sm text-muted">Create a course first.</p>
{:else}
	<Card>
		<form method="POST" action="?/create" class="flex flex-wrap items-end gap-3">
			<input
				name="name"
				placeholder="10Phy1"
				required
				class="rounded-control border border-line bg-field px-3 py-2 text-sm"
			/>
			<select name="courseId" class="rounded-control border border-line bg-field px-3 py-2 text-sm">
				{#each data.courses as course (course.id)}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
			<Button type="submit">Add class</Button>
		</form>
	</Card>
{/if}
```

- [ ] **Step 2: Autofix + verify**

Run `svelte-autofixer` until clean. `bun run dev` → `/classes`: add a class still works. Run `bun run check`.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/classes/+page.svelte"
git commit -m "feat(design): restyle classes page"
```

---

## Task 11: Settings page

**Files:**
- Modify: `src/routes/(app)/settings/+page.svelte`

Preserve every form/name and the three sections. Use `Field` + `Card` + `Button`.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/routes/(app)/settings/+page.svelte` with:

```svelte
<script lang="ts">
	import type { DayOfWeek } from '$lib/scheduling/dates';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';

	let { data } = $props();
	const dayNames: { n: DayOfWeek; label: string }[] = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	];
	const selectClass = 'rounded-control border border-line bg-field px-3 py-2 text-sm';
	const inputClass = 'rounded-control border border-line bg-field px-3 py-2 text-sm';
</script>

<PageHeader title="Settings" />

<Card class="mb-6">
	<h2 class="mb-4 font-display text-lg font-semibold">Timetable</h2>
	<form method="POST" action="?/saveConfig" class="flex flex-col gap-4">
		<Field label="Cycle length">
			<select name="cycleWeeks" class={selectClass}>
				<option value="1" selected={data.config.cycleWeeks === 1}>1 week</option>
				<option value="2" selected={data.config.cycleWeeks === 2}>2 weeks</option>
			</select>
		</Field>
		<Field label="Periods per day">
			<input
				name="periodsPerDay"
				type="number"
				min="1"
				max="10"
				value={data.config.periodsPerDay}
				class={`${inputClass} w-24`}
			/>
		</Field>
		<Field label="First teaching week is">
			<select name="anchorLetter" class={selectClass}>
				<option value="A" selected={data.config.anchorLetter === 'A'}>Week A</option>
				<option value="B" selected={data.config.anchorLetter === 'B'}>Week B</option>
			</select>
		</Field>
		<fieldset>
			<legend class="mb-2 text-sm font-medium text-ink">Teaching days</legend>
			<div class="flex flex-wrap gap-3">
				{#each dayNames as d (d.n)}
					<label class="flex items-center gap-1.5 text-sm">
						<input
							type="checkbox"
							name="teachingDays"
							value={d.n}
							checked={data.config.teachingDays.includes(d.n)}
						/>
						{d.label}
					</label>
				{/each}
			</div>
		</fieldset>
		<Button type="submit" class="w-32">Save</Button>
	</form>
</Card>

<Card class="mb-6">
	<h2 class="mb-4 font-display text-lg font-semibold">Teaching blocks</h2>
	<ul class="mb-3 flex flex-col gap-1">
		{#each data.blocks as b (b.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="font-semibold text-ink">{b.name}</span>
				<span class="text-sm text-muted">{b.startDate} → {b.endDate}</span>
				<form method="POST" action="?/deleteBlock" class="ml-auto">
					<input type="hidden" name="id" value={b.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addBlock" class="flex flex-wrap items-end gap-3">
		<input name="name" placeholder="Autumn 1" required class={inputClass} />
		<input name="startDate" type="date" required class={inputClass} />
		<input name="endDate" type="date" required class={inputClass} />
		<Button type="submit" variant="secondary">Add block</Button>
	</form>
</Card>

<Card>
	<h2 class="mb-4 font-display text-lg font-semibold">Closure days (INSET / bank holidays)</h2>
	<ul class="mb-3 flex flex-col gap-1">
		{#each data.closures as c (c.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="text-ink">{c.date}</span>
				<form method="POST" action="?/deleteClosure" class="ml-auto">
					<input type="hidden" name="id" value={c.id} />
					<Button type="submit" variant="danger" size="sm">Delete</Button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addClosure" class="flex flex-wrap items-end gap-3">
		<input name="date" type="date" required class={inputClass} />
		<Button type="submit" variant="secondary">Add closure</Button>
	</form>
</Card>
```

- [ ] **Step 2: Autofix + verify**

Run `svelte-autofixer` until clean. `bun run dev` → `/settings`: Save, Add block, Add closure all still submit. Run `bun run check`.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(app)/settings/+page.svelte"
git commit -m "feat(design): restyle settings page"
```

---

## Task 12: Login & signup pages

**Files:**
- Modify: `src/routes/login/+page.svelte`
- Modify: `src/routes/signup/+page.svelte`

Preserve: `bind:value` state, `submit` handlers, placeholders `Name`/`Email`/`Password`, button text `Sign in`/`Sign up`, and the cross links.

- [ ] **Step 1: Login**

Replace the entire contents of `src/routes/login/+page.svelte` with:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signIn.email({ email, password });
		if (res.error) error = res.error.message ?? 'Sign in failed';
		else await goto('/agenda');
	}

	const inputClass = 'rounded-control border border-line bg-field px-3 py-2.5 text-sm focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-100';
</script>

<div class="mx-auto mt-24 max-w-sm px-4">
	<h1 class="mb-1 text-center font-display text-3xl font-bold text-pink-dk">planck</h1>
	<p class="mb-6 text-center text-sm text-muted">Sign in to your account</p>
	<Card>
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<input class={inputClass} type="email" placeholder="Email" bind:value={email} required />
			<input
				class={inputClass}
				type="password"
				placeholder="Password"
				bind:value={password}
				required
			/>
			{#if error}<p class="text-sm text-danger">{error}</p>{/if}
			<Button type="submit">Sign in</Button>
			<a class="text-center text-sm text-pink-dk hover:underline" href="/signup"
				>Need an account? Sign up</a
			>
		</form>
	</Card>
</div>
```

- [ ] **Step 2: Signup**

Replace the entire contents of `src/routes/signup/+page.svelte` with:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signUp.email({ name, email, password });
		if (res.error) error = res.error.message ?? 'Sign up failed';
		else await goto('/agenda');
	}

	const inputClass = 'rounded-control border border-line bg-field px-3 py-2.5 text-sm focus:border-pink focus:outline-none focus:ring-2 focus:ring-pink-100';
</script>

<div class="mx-auto mt-24 max-w-sm px-4">
	<h1 class="mb-1 text-center font-display text-3xl font-bold text-pink-dk">planck</h1>
	<p class="mb-6 text-center text-sm text-muted">Create your account</p>
	<Card>
		<form class="flex flex-col gap-3" onsubmit={submit}>
			<input class={inputClass} placeholder="Name" bind:value={name} required />
			<input class={inputClass} type="email" placeholder="Email" bind:value={email} required />
			<input
				class={inputClass}
				type="password"
				placeholder="Password"
				bind:value={password}
				required
			/>
			{#if error}<p class="text-sm text-danger">{error}</p>{/if}
			<Button type="submit">Sign up</Button>
			<a class="text-center text-sm text-pink-dk hover:underline" href="/login"
				>Have an account? Sign in</a
			>
		</form>
	</Card>
</div>
```

- [ ] **Step 3: Autofix + verify**

Run `svelte-autofixer` on both until clean. `bun run dev`: sign-up and sign-in flows still work end to end. Run `bun run check`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/login/+page.svelte src/routes/signup/+page.svelte
git commit -m "feat(design): restyle login and signup pages"
```

---

## Task 13: Final full verification

**Files:** none (verification only)

- [ ] **Step 1: Format + lint**

Run: `bun run format && bun run lint`
Expected: lint passes with no errors.

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Unit tests**

Run: `bun run test:unit -- --run`
Expected: all scheduling specs + `colour.spec.ts` + `Button.svelte.test.ts` green.

- [ ] **Step 4: Manual smoke pass**

Run `bun run dev` and walk the full happy path on every page (signup → settings save → add course → add class → timetable assign → module add lessons + Assign → agenda shows lessons → calendar grid → move/delete a lesson). Confirm no console errors and every form still submits.

- [ ] **Step 5: Commit any formatting changes**

```bash
git add -A
git commit -m "chore(design): format and final verification" --allow-empty
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Foundations → Task 1; subject colour-coding/helper → Tasks 2 & 4 (SubjectDot + withAlpha); typography → Task 1; shell → Task 5; components → Tasks 3–4; every page in spec §4 → Tasks 6–12; verification → per-task gate + Task 13. ✅
- **Deviation from spec, intentional:** the spec's fixed per-subject pastel table is treated as guidance only; because courses/classes carry a user-chosen `colour`, the implementation derives fills from that stored colour (via `SubjectDot` and `withAlpha`) rather than a name→colour map. This keeps the pass loader-free. The "global search" is a non-functional visual element (in spec scope notes). The "New lesson" CTA from the mockup is **omitted** from the shell (no existing single creation flow to target; lessons are created per-module). This avoids inventing a feature; noted here so it isn't mistaken for a gap.
- **Placeholder scan:** no TBD/TODO; all code blocks complete. ✅
- **Type/name consistency:** token names (`pink`, `pink-hover`, `pink-dk`, `pink-50/100/200`, `ink`, `muted`, `line`, `field`, `danger`, `rounded-control`, `rounded-card`, `font-display`) are defined in Task 1 and used consistently; `withAlpha` signature matches its callers in Tasks 7 & 8; `Button` prop API (`variant`/`size`/`type`) matches all usages. ✅
```
