# Planck Reskin — Plan 1: Foundations & Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the handoff's visual language — fonts, `@theme` tokens, colour helpers, the sidebar shell, and restyled/new shared components — so every screen reskin in Plan 3 has the building blocks it needs.

**Architecture:** Retune Tailwind v4 `@theme` token *values* in place (names unchanged) so existing components inherit the look; add a `subjectTint()` colour helper; replace the top-header shell with a 256px sidebar; restyle existing shared components and add new ones (PeriodBadge, SegmentedControl, Modal, Menu, ResourceRow, BrandPanel, Sidebar).

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), Tailwind CSS v4 (`@theme`), `@fontsource-variable/*`, vitest (node `server` + browser `client` projects).

**Reference:** the prototype lives (gitignored) at `docs/design-reference/Planck.dc.html` — consult it for exact SVG icon `path` data, pixel values, and the per-subject palette quartets (`SUBJ` map, ~line 1253).

**Conventions for this plan**
- Run node specs: `bunx vitest run <file>` (project `server`).
- Run a component spec: `bunx vitest run --project client <file>` (chromium; if it errors with "Route is already handled" retry the single file, or `bunx playwright install chromium` first).
- After each task: `bun run check` must pass (svelte-check). Lint at end of plan: `bun run lint`.
- Commit after each task.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | add `@fontsource-variable/hanken-grotesk` |
| `src/routes/+layout.svelte` | import Hanken Grotesk font |
| `src/routes/layout.css` | retuned `@theme` tokens (the single source of palette truth) |
| `src/lib/colour.ts` | `withAlpha` (existing) + new `darken`, `subjectTint` |
| `src/lib/colour.spec.ts` | tests for `darken`, `subjectTint` |
| `src/lib/components/Button.svelte` | restyle (rose, radius, shadow) |
| `src/lib/components/Card.svelte` | restyle (radius-card 18px, line border) |
| `src/lib/components/Chip.svelte` | restyle; add `style`-driven subject tone |
| `src/lib/components/Field.svelte` | restyle label/spacing |
| `src/lib/components/EmptyState.svelte` | restyle (dashed card + icon tile) |
| `src/lib/components/PageHeader.svelte` | add optional `eyebrow` prop |
| `src/lib/components/PeriodBadge.svelte` | NEW — coloured P + number badge |
| `src/lib/components/SegmentedControl.svelte` | NEW — pill tab group |
| `src/lib/components/Modal.svelte` | NEW — overlay + panel + close |
| `src/lib/components/Menu.svelte` | NEW — anchored popover w/ outside-click |
| `src/lib/components/ResourceRow.svelte` | NEW — typed icon tile + title + meta + remove |
| `src/lib/components/BrandPanel.svelte` | NEW — auth left brand panel |
| `src/lib/components/Sidebar.svelte` | NEW — app sidebar (nav + classes + footer) |
| `src/lib/components/icons.ts` | NEW — shared inline SVG path snippets used across components |
| `src/routes/(app)/+layout.svelte` | replace shell with `<Sidebar>` + main |
| `src/routes/(app)/+layout.server.ts` | also load classes for the sidebar |
| `src/lib/components/*.svelte.test.ts` | new/updated browser tests where noted |

---

## Task 1: Add Hanken Grotesk font

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Install the font package**

Run:
```bash
bun add -D @fontsource-variable/hanken-grotesk
```
Expected: package added under devDependencies (matches how `inter`/`fraunces` are listed).

- [ ] **Step 2: Import it in the root layout**

In `src/routes/+layout.svelte`, replace the inter import line with hanken (keep fraunces):
```svelte
	import '@fontsource-variable/hanken-grotesk';
	import '@fontsource-variable/fraunces';
```
(Remove the `@fontsource-variable/inter` import.)

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: PASS (no missing-module error).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock src/routes/+layout.svelte
git commit -m "build: switch body font to Hanken Grotesk"
```

---

## Task 2: Retune @theme tokens

**Files:**
- Modify: `src/routes/layout.css`

- [ ] **Step 1: Replace the `@theme` block** with the handoff palette (keep token names; add `bg`, grey scale, `tray`, `field-2`):

```css
@theme {
	--font-sans: 'Hanken Grotesk Variable', ui-sans-serif, system-ui, sans-serif;
	--font-display: 'Fraunces Variable', ui-serif, Georgia, serif;

	--color-bg: #fbf8f9;

	--color-pink: #d96e92;
	--color-pink-hover: #cd5f86;
	--color-pink-dk: #a8456a;
	--color-pink-50: #fbeaf0; /* soft pink hover/menu */
	--color-pink-100: #fbe7ef; /* active nav bg */
	--color-pink-200: #e9b7c8; /* accent border / focus ring */

	--color-ink: #2b2530;
	--color-grey-1: #6a636f;
	--color-grey-2: #8a8290;
	--color-grey-3: #9a929e;
	--color-grey-4: #b0a8b4;
	--color-muted: #8a8290;

	--color-line: #f0e9ed;
	--color-field: #fbf9fa; /* input bg */
	--color-tray: #f4eef1; /* segmented/tab tray bg */

	--color-danger: #c24b6e;
	--color-success: #6fb287;
	--color-success-bg: #eaf5ee;

	--radius-control: 0.75rem; /* 12px */
	--radius-card: 1.125rem; /* 18px */
}
```

- [ ] **Step 2: Set the page background** in the base layer (replace `background: #fff`):

```css
@layer base {
	html {
		background: var(--color-bg);
		color: var(--color-ink);
		font-family: var(--font-sans);
		font-variant-numeric: tabular-nums;
		-webkit-font-smoothing: antialiased;
	}
}
```

- [ ] **Step 3: Verify the dev build compiles**

Run: `bun run check`
Expected: PASS. (Tailwind utilities like `bg-tray`, `text-grey-3` are now available.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/layout.css
git commit -m "style: retune theme tokens to the rose handoff palette"
```

---

## Task 3: Colour helpers — `darken` + `subjectTint` (TDD)

**Files:**
- Modify: `src/lib/colour.ts`
- Test: `src/lib/colour.spec.ts`

- [ ] **Step 1: Write failing tests** — append to `src/lib/colour.spec.ts`:

```ts
import { darken, subjectTint } from './colour';

describe('darken', () => {
	it('mixes a hex toward ink, returning a 6-digit hex', () => {
		const out = darken('#5ba06e', 0.35);
		expect(out).toMatch(/^#[0-9a-f]{6}$/);
		// darker than the input green
		expect(out).not.toBe('#5ba06e');
	});
	it('returns non-hex input unchanged', () => {
		expect(darken('rebeccapurple', 0.3)).toBe('rebeccapurple');
	});
});

describe('subjectTint', () => {
	it('derives dot/bar/bg/soft/text from one hex', () => {
		const t = subjectTint('#5ba06e');
		expect(t.dot).toBe('#5ba06e');
		expect(t.bar).toBe('#5ba06e');
		expect(t.bg).toBe('#5ba06e21'); // 13% alpha
		expect(t.soft).toBe('#5ba06e1a'); // 10% alpha
		expect(t.text).toMatch(/^#[0-9a-f]{6}$/);
		expect(t.text).not.toBe('#5ba06e'); // darkened for contrast
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/colour.spec.ts`
Expected: FAIL — `darken`/`subjectTint` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/colour.ts`:

```ts
const INK = { r: 0x2b, g: 0x25, b: 0x30 };

/** Mix a 6-digit hex toward ink by `amount` (0..1). Non-hex returned unchanged. */
export function darken(hex: string, amount = 0.32): string {
	if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
	const a = Math.max(0, Math.min(1, amount));
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const mix = (c: number, t: number) => Math.round(c + (t - c) * a);
	const h = (n: number) => n.toString(16).padStart(2, '0');
	return `#${h(mix(r, INK.r))}${h(mix(g, INK.g))}${h(mix(b, INK.b))}`;
}

export interface SubjectTint {
	dot: string;
	bar: string;
	bg: string;
	soft: string;
	text: string;
}

/** Reproduce the handoff's per-subject quartet from one stored hex. */
export function subjectTint(hex: string): SubjectTint {
	return {
		dot: hex,
		bar: hex,
		bg: withAlpha(hex, 0.13),
		soft: withAlpha(hex, 0.1),
		text: darken(hex, 0.32)
	};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/colour.spec.ts`
Expected: PASS (5 tests). Note: `withAlpha('#5ba06e', 0.13)` → `#5ba06e21`; if alpha rounding differs, adjust the expected hex in the test to the actual `withAlpha` output (Math.round(0.13*255)=33=0x21, 0.10*255=26=0x1a — values above are correct).

- [ ] **Step 5: Commit**

```bash
git add src/lib/colour.ts src/lib/colour.spec.ts
git commit -m "feat(colour): add darken and subjectTint helpers"
```

---

## Task 4: Shared inline-icon snippets

**Files:**
- Create: `src/lib/components/icons.ts`

Centralises the SVG `path`/`rect` markup used across components so they aren't copy-pasted. Copy the exact `path` data from `docs/design-reference/Planck.dc.html`.

- [ ] **Step 1: Create `src/lib/components/icons.ts`** — export the inner SVG strings (viewBox 0 0 24 24) for the icons reused by multiple components:

```ts
// Inner SVG markup (paste inside an <svg viewBox="0 0 24 24" ...>). Path data
// copied verbatim from docs/design-reference/Planck.dc.html.
export const ICON = {
	check: '<path d="M20 6 9 17l-5-5"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
	chevronRight: '<path d="m9 18 6-6-6-6"/>',
	chevronLeft: '<path d="m15 18-6-6 6-6"/>',
	arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
	clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
	pin: '<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
	link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
	file: '<path d="M14 3v5h5"/><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>',
	trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
	pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
	grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>'
};
```

(Components render these with `{@html}` inside an `<svg>` wrapper, or copy paths inline — see each component task. `{@html}` of static constants is safe; no user data.)

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/icons.ts
git commit -m "feat(components): add shared inline icon snippets"
```

---

## Task 5: Restyle Button

**Files:**
- Modify: `src/lib/components/Button.svelte`
- Test: `src/lib/components/Button.svelte.test.ts` (exists)

- [ ] **Step 1: Check the existing test still describes desired behaviour**

Run: `bunx vitest run --project client src/lib/components/Button.svelte.test.ts`
Expected: PASS (current). Read it; it likely asserts variant classes/rendering. Keep its assertions about *which* variant prop renders, updating any hard-coded class names you change below.

- [ ] **Step 2: Update variant/size class maps** in `Button.svelte` to the handoff look (primary = rose with shadow + rounded-control 12px):

```ts
	const base =
		'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-100';
	const sizes: Record<Size, string> = {
		md: 'h-11 px-4 text-sm',
		sm: 'h-9 px-3.5 text-xs'
	};
	const variants: Record<Variant, string> = {
		primary:
			'bg-pink text-white shadow-[0_8px_20px_-8px_rgba(201,86,128,0.55)] hover:bg-pink-hover',
		secondary: 'border border-line bg-white text-grey-1 hover:border-pink-200',
		ghost: 'bg-transparent text-grey-1 hover:bg-tray',
		danger: 'bg-pink-50 text-pink-dk hover:bg-pink-100'
	};
```
(Remove the `border` from `base` since variants now set their own borders.)

- [ ] **Step 3: Run the test**

Run: `bunx vitest run --project client src/lib/components/Button.svelte.test.ts`
Expected: PASS (after updating any asserted class strings in the test to match the new maps).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Button.svelte src/lib/components/Button.svelte.test.ts
git commit -m "style(button): rose handoff styling"
```

---

## Task 6: Restyle Card, Field, EmptyState

**Files:**
- Modify: `src/lib/components/Card.svelte`, `Field.svelte`, `EmptyState.svelte`

- [ ] **Step 1: Card** — radius-card (18px) + soft shadow:

```svelte
<div
	class={`rounded-card border border-line bg-white p-[18px] shadow-[0_1px_2px_rgba(43,37,48,0.03)] ${hover ? 'transition hover:border-pink-200 hover:shadow-[0_4px_14px_-6px_rgba(43,37,48,0.10)]' : ''} ${klass}`}
>
	{@render children?.()}
</div>
```

- [ ] **Step 2: Field** — keep API; tune label colour/weight:

```svelte
<label class="flex flex-col gap-1.5 text-[13px] font-semibold text-grey-1">
	{label}
	{@render children?.()}
</label>
```

- [ ] **Step 3: EmptyState** — dashed card + icon tile (paste the calendar icon paths from the reference):

```svelte
<div
	class="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-white px-6 py-14 text-center"
>
	<span
		class="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-pink-100 text-pink-200"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M3 9h18" /><path d="M8 2.5v4" /><path d="M16 2.5v4" />
		</svg>
	</span>
	<p class="text-sm text-grey-3">{message}</p>
</div>
```

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Card.svelte src/lib/components/Field.svelte src/lib/components/EmptyState.svelte
git commit -m "style: restyle Card, Field, EmptyState"
```

---

## Task 7: PageHeader — add `eyebrow`

**Files:**
- Modify: `src/lib/components/PageHeader.svelte`

- [ ] **Step 1: Add the prop and render a pink eyebrow above the title:**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		subtitle,
		eyebrow,
		actions,
		meta
	}: { title: string; subtitle?: string; eyebrow?: string; actions?: Snippet; meta?: Snippet } =
		$props();
</script>

<header class="mb-5">
	{#if eyebrow}
		<div class="mb-1.5 text-[13px] font-semibold text-pink-dk">{eyebrow}</div>
	{/if}
	<div class="flex flex-wrap items-baseline gap-3">
		<h1 class="font-display text-[33px] font-medium tracking-[-0.015em]">{title}</h1>
		{@render meta?.()}
		{#if actions}<div class="ml-auto flex items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{#if subtitle}<p class="mt-1.5 text-[15px] text-grey-2">{subtitle}</p>{/if}
</header>
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS (existing callers pass `title`/`subtitle`/`actions`/`meta` — all still valid).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/PageHeader.svelte
git commit -m "feat(page-header): optional eyebrow line"
```

---

## Task 8: PeriodBadge (NEW, TDD)

**Files:**
- Create: `src/lib/components/PeriodBadge.svelte`
- Test: `src/lib/components/PeriodBadge.svelte.test.ts`

- [ ] **Step 1: Write the failing browser test:**

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import PeriodBadge from './PeriodBadge.svelte';

test('renders the period number and a P label', async () => {
	const screen = render(PeriodBadge, { period: 3, colour: '#5ba06e' });
	await expect.element(screen.getByText('3')).toBeInTheDocument();
	await expect.element(screen.getByText('P')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run --project client src/lib/components/PeriodBadge.svelte.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `PeriodBadge.svelte`** (tinted square via `subjectTint`):

```svelte
<script lang="ts">
	import { subjectTint } from '$lib/colour';
	let { period, colour, dim = false }: { period: number; colour: string; dim?: boolean } = $props();
	const t = $derived(subjectTint(colour));
</script>

<div
	class="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-[12px]"
	style="background:{t.bg};color:{t.text};opacity:{dim ? 0.55 : 1}"
>
	<span class="text-[10px] font-bold tracking-[0.04em] opacity-70">P</span>
	<span class="text-[19px] font-bold leading-none">{period}</span>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run --project client src/lib/components/PeriodBadge.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PeriodBadge.svelte src/lib/components/PeriodBadge.svelte.test.ts
git commit -m "feat(components): PeriodBadge"
```

---

## Task 9: SegmentedControl (NEW, TDD)

**Files:**
- Create: `src/lib/components/SegmentedControl.svelte`
- Test: `src/lib/components/SegmentedControl.svelte.test.ts`

- [ ] **Step 1: Failing test** — clicking an option fires `onchange` with its value:

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';
import SegmentedControl from './SegmentedControl.svelte';

test('selecting an option calls onchange with its value', async () => {
	const onchange = vi.fn();
	const screen = render(SegmentedControl, {
		value: 'A',
		options: [{ value: 'A', label: 'Week A' }, { value: 'B', label: 'Week B' }],
		onchange
	});
	await screen.getByText('Week B').click();
	expect(onchange).toHaveBeenCalledWith('B');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run --project client src/lib/components/SegmentedControl.svelte.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement `SegmentedControl.svelte`:**

```svelte
<script lang="ts">
	type Option = { value: string; label: string };
	let {
		value,
		options,
		onchange
	}: { value: string; options: Option[]; onchange: (v: string) => void } = $props();
</script>

<div class="inline-flex gap-1 rounded-[10px] bg-tray p-1">
	{#each options as o (o.value)}
		<button
			type="button"
			onclick={() => onchange(o.value)}
			class="h-8 rounded-lg px-3.5 text-[13px] font-semibold transition"
			class:bg-white={value === o.value}
			class:text-ink={value === o.value}
			class:shadow-[0_1px_2px_rgba(43,37,48,0.08)]={value === o.value}
			class:text-grey-2={value !== o.value}
		>
			{o.label}
		</button>
	{/each}
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run --project client src/lib/components/SegmentedControl.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/SegmentedControl.svelte src/lib/components/SegmentedControl.svelte.test.ts
git commit -m "feat(components): SegmentedControl"
```

---

## Task 10: Modal (NEW)

**Files:**
- Create: `src/lib/components/Modal.svelte`

- [ ] **Step 1: Implement** an overlay + centered panel; `onclose` fires on backdrop click, the close button, and Escape:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { onclose, children }: { onclose: () => void; children: Snippet } = $props();
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />
<div class="fixed inset-0 z-[60] flex items-center justify-center p-6">
	<button
		type="button"
		aria-label="Close"
		class="absolute inset-0 bg-[rgba(43,37,48,0.42)]"
		onclick={onclose}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		class="relative w-full max-w-[446px] overflow-hidden rounded-[20px] bg-white shadow-[0_30px_70px_-20px_rgba(43,37,48,0.5)]"
	>
		{@render children()}
	</div>
</div>
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Modal.svelte
git commit -m "feat(components): Modal"
```

---

## Task 11: Menu (NEW — anchored popover)

**Files:**
- Create: `src/lib/components/Menu.svelte`

Used by the agenda postpone dropdown and the timetable cell popup. Renders a positioned panel with a full-screen click-catcher behind it that closes on outside click.

- [ ] **Step 1: Implement `Menu.svelte`:**

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		open,
		onclose,
		class: klass = '',
		children
	}: { open: boolean; onclose: () => void; class?: string; children: Snippet } = $props();
</script>

{#if open}
	<button
		type="button"
		aria-label="Close menu"
		class="fixed inset-0 z-30 cursor-default"
		onclick={onclose}
	></button>
	<div
		class={`absolute z-[31] rounded-[13px] border border-line bg-white p-[7px] shadow-[0_16px_36px_-12px_rgba(43,37,48,0.28)] ${klass}`}
	>
		{@render children()}
	</div>
{/if}
```

(The consumer wraps this in a `relative` element and sets position via `class` e.g. `top-14 right-3.5 w-[212px]`.)

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Menu.svelte
git commit -m "feat(components): Menu popover"
```

---

## Task 12: ResourceRow + restyle ResourceLinks/ResourceFiles

**Files:**
- Create: `src/lib/components/ResourceRow.svelte`
- Create: `src/lib/resources/meta.ts` (link/file type derivation)
- Test: `src/lib/resources/meta.spec.ts`
- Modify: `src/lib/components/ResourceLinks.svelte`, `ResourceFiles.svelte`
- Tests: `ResourceLinks.svelte.test.ts`, `ResourceFiles.svelte.test.ts` (exist)

- [ ] **Step 1: Failing test for meta derivation** — `src/lib/resources/meta.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { linkMeta, fileMeta } from './meta';

describe('linkMeta', () => {
	it('classifies youtube and falls back to host', () => {
		expect(linkMeta('https://youtube.com/watch?v=x').type).toBe('youtube');
		expect(linkMeta('https://docs.google.com/d/1').type).toBe('google');
		expect(linkMeta('https://example.com/a').host).toBe('example.com');
	});
});

describe('fileMeta', () => {
	it('maps extension to a kind label', () => {
		expect(fileMeta('a.pdf').kind).toBe('PDF');
		expect(fileMeta('a.docx').kind).toBe('DOC');
		expect(fileMeta('a.unknown').kind).toBe('FILE');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/resources/meta.spec.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/lib/resources/meta.ts`** (port from reference `linkMeta`/`fileMeta`, ~lines 1505-1522):

```ts
export type LinkType = 'youtube' | 'onedrive' | 'google' | 'link';

export function linkMeta(url: string): { type: LinkType; host: string } {
	const low = url.toLowerCase();
	const host = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
	let type: LinkType = 'link';
	if (low.includes('youtube') || low.includes('youtu.be')) type = 'youtube';
	else if (low.includes('onedrive') || low.includes('1drv') || low.includes('sharepoint'))
		type = 'onedrive';
	else if (low.includes('docs.google') || low.includes('drive.google') || low.includes('google.'))
		type = 'google';
	return { type, host: host || url };
}

export function fileMeta(name: string): { kind: string; bg: string; fg: string } {
	const ext = (name.split('.').pop() || '').toLowerCase();
	if (ext === 'pdf') return { kind: 'PDF', bg: '#fbe3e3', fg: '#c0504d' };
	if (ext === 'doc' || ext === 'docx') return { kind: 'DOC', bg: '#e2ecf7', fg: '#3f6aa3' };
	if (ext === 'ppt' || ext === 'pptx') return { kind: 'PPT', bg: '#fbe9dd', fg: '#b06a3d' };
	if (['xls', 'xlsx', 'csv'].includes(ext)) return { kind: 'XLS', bg: '#e3f1e7', fg: '#3e7c50' };
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext))
		return { kind: 'IMG', bg: '#ebe6f6', fg: '#6553a0' };
	return { kind: 'FILE', bg: '#f0ecf2', fg: '#7a7280' };
}

export const LINK_TILE: Record<LinkType, { bg: string; fg: string }> = {
	youtube: { bg: '#fbe3e3', fg: '#c0504d' },
	onedrive: { bg: '#e2ecf7', fg: '#3f6aa3' },
	google: { bg: '#e3f1e7', fg: '#3e7c50' },
	link: { bg: '#f0ecf2', fg: '#7a7280' }
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/resources/meta.spec.ts`
Expected: PASS.

- [ ] **Step 5: Implement `ResourceRow.svelte`** — icon tile + title + meta + optional remove form (used in asides). It renders a wrapping `<form>` for delete when `deleteAction` given:

```svelte
<script lang="ts">
	let {
		tileBg,
		tileFg,
		tileText = '',
		iconSvg = '',
		title,
		meta = '',
		href = '',
		deleteAction = '',
		id
	}: {
		tileBg: string;
		tileFg: string;
		tileText?: string;
		iconSvg?: string;
		title: string;
		meta?: string;
		href?: string;
		deleteAction?: string;
		id?: number;
	} = $props();
	import { enhance } from '$app/forms';
</script>

<div
	class="flex items-center gap-[11px] rounded-[11px] border border-line px-2.5 py-2.5 transition hover:border-pink-200 hover:bg-field"
>
	<span
		class="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[10.5px] font-extrabold"
		style="background:{tileBg};color:{tileFg}"
	>
		{#if iconSvg}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{@html iconSvg}</svg>{:else}{tileText}{/if}
	</span>
	<div class="min-w-0 flex-1">
		{#if href}
			<a {href} target="_blank" rel="noopener noreferrer" class="block truncate text-[13.5px] font-semibold text-ink hover:underline">{title}</a>
		{:else}
			<div class="truncate text-[13.5px] font-semibold text-ink">{title}</div>
		{/if}
		{#if meta}<div class="truncate text-xs text-grey-3">{meta}</div>{/if}
	</div>
	{#if deleteAction}
		<form method="POST" action={deleteAction} use:enhance class="shrink-0">
			<input type="hidden" name="id" value={id} />
			<button class="flex rounded p-1 text-grey-4 hover:bg-pink-50 hover:text-pink" aria-label="Remove">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
			</button>
		</form>
	{/if}
</div>
```

- [ ] **Step 6: Restyle `ResourceLinks.svelte`** to use `ResourceRow` (icon from `LINK_TILE`/`linkMeta`, title = label ?? host, meta = url) and restyle the add form (single url+label row + "Add" button styled like the reference). Keep the existing `?/addLink` / `?/deleteLink` actions and `links` prop shape. Then **read the existing test** `ResourceLinks.svelte.test.ts` and update asserted text/markup to the new structure (it should still assert that a link's label/url renders and the add form posts).

Run: `bunx vitest run --project client src/lib/components/ResourceLinks.svelte.test.ts`
Expected: PASS after updates.

- [ ] **Step 7: Restyle `ResourceFiles.svelte`** to render each file with `ResourceRow` (tile from `fileMeta`, title = filename, meta = size KB). Keep the upload logic (`onFileChange`, `@vercel/blob/client`, `?/addFile`) and `files/ownerType/ownerId` props **unchanged**; restyle the upload `<label>` to the dashed "Upload file" tile. Update `ResourceFiles.svelte.test.ts` assertions to match new markup.

Run: `bunx vitest run --project client src/lib/components/ResourceFiles.svelte.test.ts`
Expected: PASS after updates.

- [ ] **Step 8: Commit**

```bash
git add src/lib/resources/meta.ts src/lib/resources/meta.spec.ts src/lib/components/ResourceRow.svelte src/lib/components/ResourceLinks.svelte src/lib/components/ResourceFiles.svelte src/lib/components/ResourceLinks.svelte.test.ts src/lib/components/ResourceFiles.svelte.test.ts
git commit -m "feat(resources): typed ResourceRow + restyled link/file lists"
```

---

## Task 13: BrandPanel (NEW)

**Files:**
- Create: `src/lib/components/BrandPanel.svelte`

- [ ] **Step 1: Implement** the auth brand panel (gradient, logo, headline, ticks) — copy the exact gradient + copy from reference lines ~46-78. Make it `hidden md:flex` so it collapses below `md` (responsive spec):

```svelte
<div
	class="relative hidden flex-1 flex-col justify-between overflow-hidden p-14 md:flex"
	style="background:linear-gradient(160deg,#FBE7EF 0%,#F8DCE6 48%,#F3CFDD 100%)"
>
	<div class="flex items-center gap-3">
		<div class="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-pink shadow-[0_6px_16px_-6px_rgba(201,86,128,0.6)]">
			<span class="mt-0.5 font-display text-[23px] font-semibold leading-none text-white">P</span>
		</div>
		<span class="font-display text-[25px] font-semibold tracking-[-0.01em] text-pink-dk">Planck</span>
	</div>
	<div class="max-w-[440px]">
		<h1 class="m-0 mb-5 font-display text-[52px] font-medium leading-[1.05] tracking-[-0.02em] text-[#7E2F4E]">Plan your week.<br />Teach with calm.</h1>
		<p class="m-0 max-w-[380px] text-[17px] leading-[1.55] text-[#A05E76]">A quiet, tidy home for your lessons, timetable and resources — built for the classroom, not the boardroom.</p>
	</div>
	<div class="flex items-center gap-2.5 text-[13px] text-[#B07189]">
		<span class="h-[7px] w-[7px] rounded-full" style="background:#6FB287"></span>
		Synced across your devices
	</div>
	<div class="absolute -right-[70px] -bottom-[70px] h-[240px] w-[240px] rounded-full bg-white/30"></div>
</div>
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/BrandPanel.svelte
git commit -m "feat(components): auth BrandPanel"
```

---

## Task 14: Sidebar + app shell

**Files:**
- Create: `src/lib/components/Sidebar.svelte`
- Modify: `src/routes/(app)/+layout.server.ts` (load classes)
- Modify: `src/routes/(app)/+layout.svelte` (use Sidebar)

- [ ] **Step 1: Load classes in the layout server** — `src/routes/(app)/+layout.server.ts`:

```ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { listClasses } from '$lib/server/queries/classes';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(303, '/login');
	const userId = requireUserId(event);
	return {
		user: {
			id: event.locals.user.id,
			name: event.locals.user.name,
			email: event.locals.user.email
		},
		classes: await listClasses(userId)
	};
};
```

- [ ] **Step 2: Implement `Sidebar.svelte`** — brand, PLANNER nav (Agenda/Calendar/Timetable/Courses), MY CLASSES list (colour-dot links + `+` to `/classes`), footer (Settings link + Log out). Active state uses `page.url.pathname`. Copy nav icon paths from reference lines ~158-171. Props: `classes: { id; name; colour }[]`, `onsignout: () => void`.

```svelte
<script lang="ts">
	import { page } from '$app/state';
	let { classes, onsignout }: { classes: { id: number; name: string; colour: string }[]; onsignout: () => void } = $props();
	const nav = [
		{ href: '/agenda', label: 'Agenda' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/timetable', label: 'Timetable' },
		{ href: '/courses', label: 'Courses' }
	];
	function active(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
	const item = 'flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[14.5px] transition';
</script>

<aside class="flex w-64 shrink-0 flex-col border-r border-line bg-[#FAF6F7] p-4 max-md:w-[200px]">
	<a href="/agenda" class="flex items-center gap-[11px] px-2 pt-1 pb-[22px]">
		<span class="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-pink shadow-[0_5px_14px_-6px_rgba(201,86,128,0.6)]">
			<span class="mt-0.5 font-display text-[20px] font-semibold leading-none text-white">P</span>
		</span>
		<span class="font-display text-[22px] font-semibold tracking-[-0.01em] text-ink">Planck</span>
	</a>

	<nav class="flex flex-col gap-[3px]">
		<span class="px-2.5 pt-1.5 pb-1 text-[11px] font-bold tracking-[0.06em] text-grey-4 uppercase">Planner</span>
		{#each nav as n (n.href)}
			<a href={n.href} class={item} class:bg-pink-100={active(n.href)} class:font-bold={active(n.href)} style:color={active(n.href) ? 'var(--color-pink-dk)' : 'var(--color-grey-1)'}>
				<!-- paste matching icon svg from reference per n.href -->
				{n.label}
			</a>
		{/each}
	</nav>

	<div class="mt-[22px]">
		<div class="flex items-center justify-between px-2.5 pt-1.5 pb-1">
			<span class="text-[11px] font-bold tracking-[0.06em] text-grey-4 uppercase">My classes</span>
			<a href="/classes" title="Manage classes" class="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-tray text-pink-dk">
				<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
			</a>
		</div>
		<div class="mt-1 flex flex-col gap-px">
			{#each classes as c (c.id)}
				<a href="/classes/{c.id}" class="flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-sm text-grey-1 transition hover:bg-tray" class:bg-pink-100={active('/classes/' + c.id)}>
					<span class="h-[9px] w-[9px] shrink-0 rounded-[3px]" style="background:{c.colour}"></span>
					<span class="truncate">{c.name}</span>
				</a>
			{/each}
		</div>
	</div>

	<div class="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
		<a href="/settings" class={item} class:bg-pink-100={active('/settings')} style:color={active('/settings') ? 'var(--color-pink-dk)' : 'var(--color-grey-1)'}>Settings</a>
		<button type="button" onclick={onsignout} class={`${item} text-grey-3 hover:bg-pink-50 hover:text-pink`}>Log out</button>
	</div>
</aside>
```

(Paste the four nav icon SVGs + a settings icon from the reference; keep this task focused on structure.)

- [ ] **Step 3: Rewrite `(app)/+layout.svelte`** to the sidebar shell:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import Sidebar from '$lib/components/Sidebar.svelte';
	let { data, children } = $props();
	async function signOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar classes={data.classes} onsignout={signOut} />
	<main class="min-w-0 flex-1 overflow-y-auto">
		{@render children()}
	</main>
</div>
```

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/+layout.server.ts" "src/routes/(app)/+layout.svelte" src/lib/components/Sidebar.svelte
git commit -m "feat(shell): sidebar app shell with My classes"
```

---

## Task 15: Plan-1 verification sweep

- [ ] **Step 1: Type + lint**

Run: `bun run check && bun run lint`
Expected: PASS. (Run `bun run format` first if lint flags formatting.)

- [ ] **Step 2: Node specs**

Run: `bunx vitest run --project server`
Expected: PASS (colour + meta + existing scheduling specs).

- [ ] **Step 3: Component specs (per file)**

Run each: `bunx vitest run --project client src/lib/components/<name>.svelte.test.ts` for Button, PeriodBadge, SegmentedControl, ResourceLinks, ResourceFiles, LessonPlanEditor.
Expected: PASS.

- [ ] **Step 4: Visual smoke**

Run: `bun run dev`, open `/agenda` (or any app page). Confirm the sidebar renders, fonts/colours match the handoff, no console errors. (Pages themselves are reskinned in Plan 3 — at this point they render with new shared components but old page layouts.)

---

## Self-review notes (verify before finishing)
- Spec §1 (tokens/fonts/subjectTint) → Tasks 1-3. ✓
- Spec §2 (sidebar shell, drop header/search) → Task 14. ✓
- Spec §3 (shared restyle + new components, resource typing) → Tasks 5-13. ✓
- `subjectTint` shape `{dot,bar,bg,soft,text}` used consistently in PeriodBadge (Task 8) and Plan 3.
- Per-class colour (Spec §4) is NOT in this plan — the sidebar uses `listClasses` colour (course-derived) until Plan 2 switches it; this is intentional and still renders.
