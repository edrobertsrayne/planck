# Phase C — Confirmation Dialogs for Destructive Deletes (issue #23)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guard the three destructive cascade deletes (subject/course, class, module) behind a confirmation dialog that shows the blast radius, while leaving single scheduled-lesson and template-lesson deletes one-click.

**Architecture:** A reusable `ConfirmDelete.svelte` wraps the existing `Modal.svelte`. It renders a caller-supplied trigger (the existing trash button), and on open lazily fetches blast-radius counts from one shared session-scoped endpoint `GET /api/deletion-impact?type=<course|class|module>&id=<n>`. The dialog's Delete button submits the page's existing `?/delete` form action **unchanged** — deletion is still the server-side cascade (Phase A); the dialog is purely a gate + display. Blast-radius message text is a pure, unit-tested function.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle (neon-http), Vitest (unit), Playwright (e2e against a forked Neon `test` branch + real Vercel Blob).

---

## Background facts (verified against the codebase)

- **Phase A (#1) and Phase B (#32) are merged.** Cascade deletes already reclaim blobs via `deleteAndReclaim`/`reclaimBlobs` in `src/lib/server/queries/resource-cleanup.ts`. This plan adds **only** the confirmation UI + impact endpoint. It changes no delete behaviour.
- **The three guarded deletes today:**
  - **Subject (course):** inline `<form action="?/delete">` in `src/routes/(app)/courses/+page.svelte` (lines 48–70); action `delete` → `deleteCourse` in `src/routes/(app)/courses/+page.server.ts`.
  - **Class:** inline `<form action="?/delete">` in `src/routes/(app)/classes/+page.svelte` (lines 35–57); action `delete` → `deleteClass` in `src/routes/(app)/classes/+page.server.ts`.
  - **Module:** action `delete` → `deleteModule` **already exists** in `src/routes/(app)/courses/[courseId]/+page.server.ts` (lines 56–60), **but there is no UI button for it yet.** This plan adds a per-module delete trigger on the course detail page (`src/routes/(app)/courses/[courseId]/+page.svelte`), where that action lives — mirroring the inline delete pattern on the courses/classes lists.
- **Left unguarded (one-click), per the spec:** single scheduled-lesson delete (`src/routes/(app)/classes/[classId]/+page.svelte`, "Delete" button) and template-lesson delete (`src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`, "Delete lesson" button). **Do not touch these.**
- **Adding a dialog to the courses/classes lists BREAKS two existing e2e tests** in `e2e/blob-cleanup.e2e.ts` (they click "Delete subject" / "Delete class" and expect immediate deletion). Tasks 5 and 6 update those clicks to go through the dialog. The "Delete lesson" (line ~104) and scheduled-lesson "Delete" (line ~191) clicks in that file stay as-is.
- **`Modal.svelte`** takes `{ onclose, children }`. **`Button.svelte`** supports `variant="primary|secondary|danger"`, `size`, `type="submit"`, and `onclick` (verified in `classes/[classId]/+page.svelte` and `courses/[courseId]/modules/[moduleId]/+page.svelte`).
- **Count idiom:** `sql<number>\`count(\*)\``returns a string from neon-http; existing code wraps with`Number(...)` (`src/lib/server/queries/resources.ts:121`). Do the same so JSON serializes real numbers.
- **API auth idiom:** `requireUserId(event)` from `$lib/server/session` (throws 401). See `src/routes/api/resource-files/upload/+server.ts`.
- **Commands:** unit tests `bun run test:unit -- --run <file>`; full e2e `bun run test:e2e` (resets the test DB, then Playwright); single e2e file `bunx playwright test <file>` (after at least one `bun run db:test:reset`). e2e requires `.env.local` (`NEON_API_KEY`) and a one-time `bun run db:test:setup`.

---

## File structure

| File                                                        | Responsibility                                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/resources/deletion-message.ts` (new)               | Pure: types (`DeletionType`, `DeletionImpact`) + `deletionMessage()` building the blast-radius sentence.                               |
| `src/lib/resources/deletion-message.spec.ts` (new)          | Unit tests for `deletionMessage()`.                                                                                                    |
| `src/lib/server/queries/deletion-impact.ts` (new)           | DB: `courseDeletionImpact` / `classDeletionImpact` / `moduleDeletionImpact` count queries. Thin.                                       |
| `src/routes/api/deletion-impact/+server.ts` (new)           | `GET` endpoint: auth, validate `type`/`id`, dispatch to the impact query, return JSON.                                                 |
| `src/lib/components/ConfirmDelete.svelte` (new)             | Reusable trigger + Modal dialog; lazy-fetches impact; Delete submits the page's `?/delete` form.                                       |
| `src/routes/(app)/courses/+page.svelte` (modify)            | Replace inline subject-delete form with `ConfirmDelete type="course"`.                                                                 |
| `src/routes/(app)/classes/+page.svelte` (modify)            | Replace inline class-delete form with `ConfirmDelete type="class"`.                                                                    |
| `src/routes/(app)/courses/[courseId]/+page.svelte` (modify) | Add per-module `ConfirmDelete type="module"` trigger (new delete button).                                                              |
| `e2e/blob-cleanup.e2e.ts` (modify)                          | Click through the new dialog for the subject and class deletes.                                                                        |
| `e2e/confirm-delete.e2e.ts` (new)                           | e2e: each guarded delete opens a dialog with non-zero counts; Cancel aborts; Delete cascades; scheduled-lesson delete stays one-click. |

---

## Task 1: Blast-radius message (pure)

**Files:**

- Create: `src/lib/resources/deletion-message.ts`
- Test: `src/lib/resources/deletion-message.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/resources/deletion-message.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deletionMessage } from './deletion-message';

describe('deletionMessage', () => {
	it('describes a course/subject blast radius', () => {
		expect(deletionMessage('course', { classes: 3, scheduledLessons: 41, files: 12 })).toBe(
			'This deletes this subject, its 3 classes, 41 scheduled lessons and 12 files. This cannot be undone.'
		);
	});

	it('describes a class blast radius', () => {
		expect(deletionMessage('class', { scheduledLessons: 8, files: 2 })).toBe(
			'This deletes this class, 8 scheduled lessons and 2 files. This cannot be undone.'
		);
	});

	it('describes a module blast radius', () => {
		expect(deletionMessage('module', { lessons: 5, files: 0 })).toBe(
			'This deletes this module, its 5 lessons and 0 files. This cannot be undone.'
		);
	});

	it('uses singular nouns for a count of 1 (including "class")', () => {
		expect(deletionMessage('course', { classes: 1, scheduledLessons: 1, files: 1 })).toBe(
			'This deletes this subject, its 1 class, 1 scheduled lesson and 1 file. This cannot be undone.'
		);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/resources/deletion-message.spec.ts`
Expected: FAIL — cannot resolve `./deletion-message`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/resources/deletion-message.ts`:

```ts
export type DeletionType = 'course' | 'class' | 'module';

/** Blast-radius counts; only the fields relevant to `type` are populated. */
export interface DeletionImpact {
	classes?: number;
	scheduledLessons?: number;
	lessons?: number;
	files?: number;
}

/** "3 classes" / "1 class" — pluralizes with an explicit plural form. */
function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** A human sentence describing what deleting `type` will remove. Display-only. */
export function deletionMessage(type: DeletionType, impact: DeletionImpact): string {
	const files = count(impact.files ?? 0, 'file', 'files');
	if (type === 'course') {
		const classes = count(impact.classes ?? 0, 'class', 'classes');
		const lessons = count(impact.scheduledLessons ?? 0, 'scheduled lesson', 'scheduled lessons');
		return `This deletes this subject, its ${classes}, ${lessons} and ${files}. This cannot be undone.`;
	}
	if (type === 'class') {
		const lessons = count(impact.scheduledLessons ?? 0, 'scheduled lesson', 'scheduled lessons');
		return `This deletes this class, ${lessons} and ${files}. This cannot be undone.`;
	}
	const lessons = count(impact.lessons ?? 0, 'lesson', 'lessons');
	return `This deletes this module, its ${lessons} and ${files}. This cannot be undone.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/resources/deletion-message.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resources/deletion-message.ts src/lib/resources/deletion-message.spec.ts
git commit -m "Phase C: pure blast-radius message builder (#23)"
```

---

## Task 2: Deletion-impact count queries

**Files:**

- Create: `src/lib/server/queries/deletion-impact.ts`

These are thin DB queries (proven end-to-end in Task 8, per the project's convention that DB-backed behaviour is tested via e2e, not mocks). Each is user-scoped and walks the same FK graph as `descendantFilePathnames`, but counts `resource_file` **rows** removed rather than de-duplicating blob pathnames.

- [ ] **Step 1: Write the query module**

Create `src/lib/server/queries/deletion-impact.ts`:

```ts
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { klass, module, lesson, scheduledLesson, resourceFile } from '$lib/server/db/schema';

/** Count this user's resource_file rows where `column` is in `ids`. */
async function countFilesIn(userId: string, column: AnyPgColumn, ids: number[]): Promise<number> {
	if (ids.length === 0) return 0;
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), inArray(column, ids)));
	return Number(row?.n ?? 0);
}

export async function moduleDeletionImpact(
	userId: string,
	id: number
): Promise<{ lessons: number; files: number }> {
	const lessons = await db
		.select({ id: lesson.id })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, id)));
	const files =
		(await countFilesIn(userId, resourceFile.moduleId, [id])) +
		(await countFilesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((l) => l.id)
		));
	return { lessons: lessons.length, files };
}

export async function classDeletionImpact(
	userId: string,
	id: number
): Promise<{ scheduledLessons: number; files: number }> {
	const scheduled = await db
		.select({ id: scheduledLesson.id })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, id)));
	const files = await countFilesIn(
		userId,
		resourceFile.scheduledLessonId,
		scheduled.map((s) => s.id)
	);
	return { scheduledLessons: scheduled.length, files };
}

export async function courseDeletionImpact(
	userId: string,
	id: number
): Promise<{ classes: number; scheduledLessons: number; files: number }> {
	const modules = await db
		.select({ id: module.id })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, id)));
	const moduleIds = modules.map((m) => m.id);
	const lessons =
		moduleIds.length === 0
			? []
			: await db
					.select({ id: lesson.id })
					.from(lesson)
					.where(and(eq(lesson.userId, userId), inArray(lesson.moduleId, moduleIds)));
	const classes = await db
		.select({ id: klass.id })
		.from(klass)
		.where(and(eq(klass.userId, userId), eq(klass.courseId, id)));
	const classIds = classes.map((c) => c.id);
	const scheduled =
		classIds.length === 0
			? []
			: await db
					.select({ id: scheduledLesson.id })
					.from(scheduledLesson)
					.where(
						and(eq(scheduledLesson.userId, userId), inArray(scheduledLesson.classId, classIds))
					);
	const files =
		(await countFilesIn(userId, resourceFile.courseId, [id])) +
		(await countFilesIn(userId, resourceFile.moduleId, moduleIds)) +
		(await countFilesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((l) => l.id)
		)) +
		(await countFilesIn(
			userId,
			resourceFile.scheduledLessonId,
			scheduled.map((s) => s.id)
		));
	return { classes: classes.length, scheduledLessons: scheduled.length, files };
}
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors referencing `deletion-impact.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/queries/deletion-impact.ts
git commit -m "Phase C: deletion-impact count queries (#23)"
```

---

## Task 3: `/api/deletion-impact` endpoint

**Files:**

- Create: `src/routes/api/deletion-impact/+server.ts`

- [ ] **Step 1: Write the endpoint**

Create `src/routes/api/deletion-impact/+server.ts`:

```ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	courseDeletionImpact,
	classDeletionImpact,
	moduleDeletionImpact
} from '$lib/server/queries/deletion-impact';

export const GET: RequestHandler = async (event) => {
	const userId = requireUserId(event);
	const type = event.url.searchParams.get('type');
	const id = Number(event.url.searchParams.get('id'));
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid id');

	if (type === 'course') return json(await courseDeletionImpact(userId, id));
	if (type === 'class') return json(await classDeletionImpact(userId, id));
	if (type === 'module') return json(await moduleDeletionImpact(userId, id));
	throw error(400, 'Invalid type');
};
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors. (`./$types` is generated by `svelte-kit sync`, which `check` runs first.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/deletion-impact/+server.ts
git commit -m "Phase C: GET /api/deletion-impact endpoint (#23)"
```

---

## Task 4: `ConfirmDelete.svelte` component

**Files:**

- Create: `src/lib/components/ConfirmDelete.svelte`

This component renders a caller-supplied `trigger` snippet (passed an `open` callback). On open it lazily fetches impact counts; the dialog shows `deletionMessage(...)` and a Delete button inside a `<form method="POST" action="?/delete">` so deletion uses the page's existing action unchanged. This exact code passed the Svelte autofixer with zero issues — keep it verbatim.

- [ ] **Step 1: Create the component**

Create `src/lib/components/ConfirmDelete.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import {
		deletionMessage,
		type DeletionImpact,
		type DeletionType
	} from '$lib/resources/deletion-message';

	let {
		type,
		id,
		name,
		action = '?/delete',
		trigger
	}: {
		type: DeletionType;
		id: number;
		name: string;
		action?: string;
		trigger: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let impact = $state<DeletionImpact | null>(null);

	async function show() {
		open = true;
		impact = null;
		const res = await fetch(`/api/deletion-impact?type=${type}&id=${id}`);
		if (res.ok) impact = await res.json();
	}

	function close() {
		open = false;
	}
</script>

{@render trigger(show)}

{#if open}
	<Modal onclose={close}>
		<div class="p-[22px]">
			<h2 class="m-0 font-display text-xl font-medium text-ink">Delete {name}?</h2>
			<p class="m-0 mt-2 text-[14px] text-grey-2">
				{impact ? deletionMessage(type, impact) : 'Calculating what will be removed…'}
			</p>
		</div>
		<div class="flex items-center justify-end gap-3 border-t border-line p-[18px]">
			<Button variant="secondary" onclick={close}>Cancel</Button>
			<form
				method="POST"
				{action}
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						close();
					};
				}}
			>
				<input type="hidden" name="id" value={id} />
				<Button type="submit" variant="danger">Delete</Button>
			</form>
		</div>
	</Modal>
{/if}
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no new errors referencing `ConfirmDelete.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ConfirmDelete.svelte
git commit -m "Phase C: ConfirmDelete dialog component (#23)"
```

---

## Task 5: Guard subject (course) delete + fix its e2e

**Files:**

- Modify: `src/routes/(app)/courses/+page.svelte` (replace lines 48–70 form; add import)
- Modify: `e2e/blob-cleanup.e2e.ts` (the "Delete subject" click, ~line 86)

- [ ] **Step 1: Import `ConfirmDelete`**

In `src/routes/(app)/courses/+page.svelte`, add to the `<script>` imports (after the `EmptyState` import):

```svelte
import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
```

- [ ] **Step 2: Replace the inline delete form with `ConfirmDelete`**

Replace this block (currently lines 48–70, the `<form method="POST" action="?/delete" ...>…</form>`):

```svelte
<form method="POST" action="?/delete" use:enhance>
	<input type="hidden" name="id" value={c.id} />
	<button
		type="submit"
		title="Delete subject"
		class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
	>
		<svg
			width="17"
			height="17"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.9"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M3 6h18"></path>
			<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
		</svg>
	</button>
</form>
```

with:

```svelte
<ConfirmDelete type="course" id={c.id} name={c.name}>
	{#snippet trigger(open)}
		<button
			type="button"
			onclick={open}
			title="Delete subject"
			class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
		>
			<svg
				width="17"
				height="17"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.9"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 6h18"></path>
				<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
			</svg>
		</button>
	{/snippet}
</ConfirmDelete>
```

Note: `use:enhance` may now be unused in this file's imports. If `bun run check`/lint flags `enhance` as unused, remove it from the `import { enhance } from '$app/forms';` line (the `?/create` form at the bottom still uses `use:enhance`, so it likely stays — verify before removing).

- [ ] **Step 3: Update the broken e2e click**

In `e2e/blob-cleanup.e2e.ts`, in the test `deleting a subject reclaims its lesson file blobs`, change:

```ts
await page.goto('/courses');
await page.getByRole('button', { name: 'Delete subject' }).first().click();
await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);
```

to:

```ts
await page.goto('/courses');
await page.getByRole('button', { name: 'Delete subject' }).first().click();
await page.getByRole('button', { name: 'Delete', exact: true }).click();
await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);
```

- [ ] **Step 4: Verify type-check + lint**

Run: `bun run check && bun run lint`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/courses/+page.svelte e2e/blob-cleanup.e2e.ts
git commit -m "Phase C: confirm dialog for subject delete (#23)"
```

---

## Task 6: Guard class delete + fix its e2e

**Files:**

- Modify: `src/routes/(app)/classes/+page.svelte` (replace lines 35–57 form; add import)
- Modify: `e2e/blob-cleanup.e2e.ts` (the "Delete class" click, ~line 134)

- [ ] **Step 1: Import `ConfirmDelete`**

In `src/routes/(app)/classes/+page.svelte`, add to the `<script>` imports (after `EmptyState`):

```svelte
import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
```

- [ ] **Step 2: Replace the inline delete form with `ConfirmDelete`**

Replace this block (currently lines 35–57, the `<form method="POST" action="?/delete" ...>…</form>`):

```svelte
<form method="POST" action="?/delete" use:enhance>
	<input type="hidden" name="id" value={c.id} />
	<button
		type="submit"
		title="Delete class"
		class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
	>
		<svg
			width="17"
			height="17"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.9"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M3 6h18"></path>
			<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
		</svg>
	</button>
</form>
```

with:

```svelte
<ConfirmDelete type="class" id={c.id} name={c.name}>
	{#snippet trigger(open)}
		<button
			type="button"
			onclick={open}
			title="Delete class"
			class="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-grey-3 transition hover:bg-pink-50 hover:text-pink-dk"
		>
			<svg
				width="17"
				height="17"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.9"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 6h18"></path>
				<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
			</svg>
		</button>
	{/snippet}
</ConfirmDelete>
```

Note: the `?/create` form at the bottom still uses `use:enhance`, so the `enhance` import stays. Confirm with `bun run lint`.

- [ ] **Step 3: Update the broken e2e click**

In `e2e/blob-cleanup.e2e.ts`, in the test `shared blob survives template-lesson delete, reclaimed when last reference goes`, change the final class delete:

```ts
// Delete the class — removes the last reference; blob is reclaimed.
await page.goto('/classes');
await page.getByRole('button', { name: 'Delete class' }).first().click();
```

to:

```ts
// Delete the class — removes the last reference; blob is reclaimed.
await page.goto('/classes');
await page.getByRole('button', { name: 'Delete class' }).first().click();
await page.getByRole('button', { name: 'Delete', exact: true }).click();
```

(Leave the scheduled-lesson "Delete" click in the test `deleting a scheduled lesson reclaims its blob…` — that one is on the class **detail** page and stays one-click.)

- [ ] **Step 4: Verify type-check + lint**

Run: `bun run check && bun run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/classes/+page.svelte e2e/blob-cleanup.e2e.ts
git commit -m "Phase C: confirm dialog for class delete (#23)"
```

---

## Task 7: Add a guarded module delete on the course detail page

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/+page.svelte` (add import; add delete trigger to each module row)

The `deleteModule` action already exists as `?/delete` in `src/routes/(app)/courses/[courseId]/+page.server.ts`. There is currently no module-delete button; this task adds one per module row (shown on hover, like the up/down controls).

- [ ] **Step 1: Import `ConfirmDelete`**

In `src/routes/(app)/courses/[courseId]/+page.svelte`, add to the `<script>` imports (after `EmptyState`):

```svelte
import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
```

- [ ] **Step 2: Add the delete trigger to each module row**

In the module `<li>`, the controls live in `<div class="flex shrink-0 items-center gap-1">` (currently lines 168–185) holding the two `?/reorder` forms. Immediately **after** the closing `</form>` of the second (move-down) reorder form and **before** that `</div>` closes, add:

```svelte
<ConfirmDelete type="module" id={m.id} name={m.name}>
	{#snippet trigger(open)}
		<button
			type="button"
			onclick={open}
			title="Delete module"
			class="px-1 text-grey-3 opacity-0 transition group-hover:opacity-100 hover:text-pink-dk group-focus-within:opacity-100"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.9"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 6h18"></path>
				<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
			</svg>
		</button>
	{/snippet}
</ConfirmDelete>
```

(The row is `class="group ..."`, so `group-hover`/`group-focus-within` reveal the button on hover, matching the existing reorder-control behaviour.)

- [ ] **Step 3: Verify type-check + lint**

Run: `bun run check && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/courses/\[courseId\]/+page.svelte
git commit -m "Phase C: guarded module delete on course detail page (#23)"
```

---

## Task 8: End-to-end tests for the confirmation dialogs

**Files:**

- Create: `e2e/confirm-delete.e2e.ts`

Covers the spec's acceptance criteria: each guarded delete opens a dialog with non-zero counts; Cancel aborts; Delete cascades; single scheduled-lesson delete stays one-click. Mirrors the signup/create helpers used in `e2e/blob-cleanup.e2e.ts`.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/confirm-delete.e2e.ts`:

```ts
/// <reference types="node" />
import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page) {
	const email = `teacher_${Date.now()}@example.com`;
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);
}

/** Subject → module "Forces" → one lesson "L1 Intro". */
async function createSubjectWithLesson(page: Page, subject: string) {
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: subject }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('Add a lesson to this module').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();
	await expect(page.getByLabel('Lesson title')).toHaveValue('L1 Intro');
}

async function createClass(page: Page, subject: string, className: string) {
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill(className);
	await page.locator('select[name="courseId"]').selectOption({ label: subject });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByRole('link', { name: className, exact: true })).toBeVisible();
}

/** Assign module "Forces" (under `subject`) to `className` — schedules its lesson. */
async function assignForcesTo(page: Page, subject: string, className: string) {
	await page.goto('/courses');
	await page.getByRole('link', { name: subject }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('button', { name: 'Assign to class' }).click();
	await page.getByRole('button', { name: className }).click();
	await page.getByRole('button', { name: /Assign to 1 class/ }).click();
}

test('subject delete: dialog shows non-zero counts, Cancel aborts, Delete cascades', async ({
	page
}) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Physics');
	await createClass(page, 'GCSE Physics', '10Phy1');
	await assignForcesTo(page, 'GCSE Physics', '10Phy1');

	// Open the confirm dialog from the courses list.
	await page.goto('/courses');
	await page.getByRole('button', { name: 'Delete subject' }).first().click();

	// Blast radius shows non-zero counts (1 class, 1 scheduled lesson).
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('its 1 class');
	await expect(dialog).toContainText('1 scheduled lesson');

	// Cancel aborts — the subject is still there.
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toBeVisible();

	// Reopen and confirm — the subject is gone.
	await page.getByRole('button', { name: 'Delete subject' }).first().click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);
});

test('class delete: dialog confirms then cascades', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Biology');
	await createClass(page, 'GCSE Biology', '10Bio1');
	await assignForcesTo(page, 'GCSE Biology', '10Bio1');

	await page.goto('/classes');
	await page.getByRole('button', { name: 'Delete class' }).first().click();
	await expect(page.getByRole('dialog')).toContainText('1 scheduled lesson');

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: '10Bio1', exact: true })).toHaveCount(0);
});

test('module delete: dialog shows lesson count then cascades', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Chemistry');

	// On the course detail page, the module row has a Delete module trigger.
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Chemistry' }).click();
	await page.getByRole('button', { name: 'Delete module' }).first().click();
	await expect(page.getByRole('dialog')).toContainText('its 1 lesson');

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Forces' })).toHaveCount(0);
});

test('single scheduled-lesson delete stays one-click (no dialog)', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE History');
	await createClass(page, 'GCSE History', '10His1');
	await assignForcesTo(page, 'GCSE History', '10His1');

	await page.goto('/classes');
	await page.getByRole('link', { name: '10His1', exact: true }).click();
	await expect(page.locator('input[aria-label="Lesson title"]')).toHaveCount(1);

	// Clicking Delete removes the lesson immediately — no confirm dialog.
	await page.getByRole('button', { name: 'Delete' }).first().click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.locator('input[aria-label="Lesson title"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the new e2e spec**

Run: `bunx playwright test e2e/confirm-delete.e2e.ts`
(If the test DB has not been reset this session, first run `bun run db:test:reset`. First-time setup: `bun run db:test:setup`.)
Expected: 4 tests PASS.

- [ ] **Step 3: Run the previously-touched e2e spec to confirm no regression**

Run: `bunx playwright test e2e/blob-cleanup.e2e.ts`
Expected: all PASS (the updated subject/class deletes click through the dialog).

- [ ] **Step 4: Commit**

```bash
git add e2e/confirm-delete.e2e.ts
git commit -m "Phase C: e2e for confirm-delete dialogs (#23)"
```

---

## Final verification

- [ ] **Unit + type-check + lint:**

Run: `bun run test:unit -- --run && bun run check && bun run lint`
Expected: all PASS.

- [ ] **Full e2e suite:**

Run: `bun run test:e2e`
Expected: all PASS (includes the updated `blob-cleanup` and new `confirm-delete` specs).

---

## Self-review (against issue #23 / Layer 3 of the spec)

- **Guard subject, class, module deletion; leave single scheduled-lesson + template-lesson deletes unguarded** → Tasks 5, 6, 7 guard exactly the three; Task 8's fourth test pins the scheduled-lesson delete as one-click; template-lesson "Delete lesson" is never touched. ✅
- **Reuse `Modal.svelte`; add `ConfirmDelete.svelte` (title, blast-radius message, Cancel + Delete); Delete submits the existing `?/delete` form unchanged** → Task 4 (`ConfirmDelete` wraps `Modal`, renders title + message + Cancel/Delete, Delete is a `<form action="?/delete">`). ✅
- **One shared session-scoped `GET /api/deletion-impact?type=&id=`, fetched lazily on open; course→{classes,scheduledLessons,files}, class→{scheduledLessons,files}, module→{lessons,files}** → Tasks 2 (queries return exactly those shapes) + 3 (single endpoint, `requireUserId`) + 4 (`fetch` in `show()` on open). ✅
- **e2e: each guarded delete opens dialog with non-zero counts; Cancel aborts; Delete cascades; single scheduled-lesson stays one-click** → Task 8 (4 tests) + the dialog click-throughs added to `blob-cleanup` in Tasks 5–6. ✅
- **Type consistency:** `DeletionType`/`DeletionImpact` defined in Task 1, imported by Tasks 3-shape (queries match `DeletionImpact` fields) and Task 4 (`ConfirmDelete`); endpoint `type` values `course|class|module` match `DeletionType`; `deletionMessage(type, impact)` signature is identical in component and tests. ✅
- **No behaviour change to deletion:** all delete actions still call the existing Phase A cascade; the dialog only gates + displays. ✅

```

```
