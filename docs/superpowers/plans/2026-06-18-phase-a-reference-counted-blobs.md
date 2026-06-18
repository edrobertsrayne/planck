# Phase A: Reference-Counted Blob Reclamation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `resource_file` deletion path reclaim its backing Vercel Blob when the last reference to that blob's pathname is removed, and switch lesson-scheduling from physically copying blobs to sharing one blob by reference — closing issue #1.

**Architecture:** Scheduling stops duplicating blobs and instead reuses the source `blobUrl`/`pathname` (Layer 0). A new cleanup module gathers the pathnames a cascade will remove, runs the row delete, then deletes only the blobs no longer referenced by any row (Layer 1, reference-counted). The `scheduled_lesson.lesson_id`/`module_id` FKs flip to `set null` so deleting content (a module or template lesson) detaches scheduled lessons rather than destroying them.

**Tech Stack:** SvelteKit, TypeScript, Drizzle ORM (neon-http — **no transactions**), `@vercel/blob`, vitest (unit), Playwright (e2e against a forked Neon `test` branch).

**Spec:** `docs/superpowers/specs/2026-06-18-orphaned-blob-cleanup-design.md` (Layers 0 + 1 + the FK migration).

---

## Prerequisites (read before starting)

- Work on branch `feat/reclaim-orphaned-blobs` (already checked out).
- **No DB transactions** exist (`neon-http`). Ordering is the only safety mechanism: gather pathnames → delete rows → reclaim blobs. Never reverse this.
- Unit tests: `bun run test:unit -- --run`. Typecheck: `bun run check`. Lint/format: `bun run lint` / `bun run format`.
- e2e tests run against a real forked Neon branch **and real Vercel Blob**:
  - One-time per schema change: `bun run db:test:setup` (needs `NEON_API_KEY` + a working `.env.local` with `BLOB_READ_WRITE_TOKEN`; writes `.env.test`).
  - Then: `bun run test:e2e`.
- Each scheduled lesson and template lesson maps a `resource_file` row to a `pathname`. After Layer 0, a scheduled copy shares the **same** pathname as its template. A blob must be deleted only when **no** `resource_file` row references its pathname.

## File Structure

- **Create** `src/lib/resources/reclaim.ts` — pure `pathnamesToReclaim(candidates, stillReferenced)`. No DB/IO. Unit-tested.
- **Create** `src/lib/resources/reclaim.spec.ts` — unit tests for the above.
- **Create** `src/lib/server/queries/resource-cleanup.ts` — `CascadeRoot` type, `descendantFilePathnames`, `reclaimBlobs`, `deleteAndReclaim`. The only module that knows the cascade graph for cleanup.
- **Modify** `src/lib/server/db/schema.ts` — `scheduled_lesson.lesson_id` + `module_id` → `onDelete: 'set null'`.
- **Modify** `src/lib/resources/copy.ts` — `buildCopiedFileRows` shares source `blobUrl`/`pathname` (drops the `copies` arg + `CopiedBlob`).
- **Modify** `src/lib/resources/copy.spec.ts` — match the new signature.
- **Modify** `src/lib/server/blob.ts` — add `deleteBlobs`; remove `copyBlob` + the `copy` import.
- **Modify** `src/lib/server/queries/schedule.ts` — `copyLessonContent` shares blobs; wire `unscheduleModule` + `deleteFromSequence` through `deleteAndReclaim`.
- **Modify** `src/lib/server/queries/courses.ts` — `deleteCourse`/`deleteModule`/`deleteLesson` via `deleteAndReclaim`.
- **Modify** `src/lib/server/queries/classes.ts` — `deleteClass` via `deleteAndReclaim`.
- **Modify** `src/lib/server/queries/resources.ts` — `deleteFile` uses `reclaimBlobs`.
- **Create** `e2e/blob-cleanup.e2e.ts` — cascade reclamation + reference-counting/decouple e2e.
- **Generated** `drizzle/*` — the FK migration from `db:generate`.

---

## Task 1: Flip scheduled_lesson FKs to `set null` + migration

**Files:**

- Modify: `src/lib/server/db/schema.ts:97-98`
- Generated: `drizzle/` (new migration + snapshot)

- [ ] **Step 1: Edit the schema**

In `src/lib/server/db/schema.ts`, change the two FK definitions inside `scheduledLesson`:

```ts
		// Nullable: null = a blank inserted spacer with no underlying lesson template,
		// or a row detached when its template lesson/module was deleted.
		lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'set null' }),
		moduleId: integer('module_id').references(() => module.id, { onDelete: 'set null' }),
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new file under `drizzle/` (e.g. `drizzle/0007_*.sql`) plus an updated `drizzle/meta/` snapshot.

- [ ] **Step 3: Verify the generated SQL**

Open the new `drizzle/*.sql`. Confirm it drops and re-adds both FKs with `ON DELETE set null` (Drizzle emits `ALTER TABLE "scheduled_lesson" DROP CONSTRAINT ...` then `ADD CONSTRAINT ... ON DELETE set null`). It must reference `scheduled_lesson_lesson_id_*` and `scheduled_lesson_module_id_*`. No other tables should change.

- [ ] **Step 4: Typecheck**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle
git commit -m "feat: detach scheduled lessons on content delete (lesson_id/module_id set null) (#1)"
```

---

## Task 2: Pure `pathnamesToReclaim` helper (TDD)

**Files:**

- Create: `src/lib/resources/reclaim.ts`
- Test: `src/lib/resources/reclaim.spec.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/resources/reclaim.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathnamesToReclaim } from './reclaim';

describe('pathnamesToReclaim', () => {
	it('returns candidates that are no longer referenced', () => {
		expect(pathnamesToReclaim(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
	});

	it('de-duplicates candidates', () => {
		expect(pathnamesToReclaim(['a', 'a', 'b'], [])).toEqual(['a', 'b']);
	});

	it('returns nothing when every candidate is still referenced', () => {
		expect(pathnamesToReclaim(['a', 'b'], ['a', 'b'])).toEqual([]);
	});

	it('returns nothing for empty candidates', () => {
		expect(pathnamesToReclaim([], ['a'])).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/resources/reclaim.spec.ts`
Expected: FAIL — cannot find module `./reclaim`.

- [ ] **Step 3: Write the implementation**

`src/lib/resources/reclaim.ts`:

```ts
/**
 * Of the candidate pathnames, the ones safe to delete from blob storage:
 * those not present in `stillReferenced` (the pathnames still backed by a
 * `resource_file` row after the delete). De-duplicated, order preserved.
 */
export function pathnamesToReclaim(candidates: string[], stillReferenced: string[]): string[] {
	const referenced = new Set(stillReferenced);
	return [...new Set(candidates)].filter((p) => !referenced.has(p));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/resources/reclaim.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resources/reclaim.ts src/lib/resources/reclaim.spec.ts
git commit -m "feat: add pathnamesToReclaim reference-count helper (#1)"
```

---

## Task 3: Share blobs in `buildCopiedFileRows` (TDD)

**Files:**

- Modify: `src/lib/resources/copy.ts:32-80`
- Modify: `src/lib/resources/copy.spec.ts:35-63`

- [ ] **Step 1: Update the test to the new signature (failing)**

Replace the entire `describe('buildCopiedFileRows', …)` block in `src/lib/resources/copy.spec.ts` with:

```ts
describe('buildCopiedFileRows', () => {
	it('reuses the source blob (shared pathname), preserving metadata', () => {
		const rows = buildCopiedFileRows(
			[
				{
					blobUrl: 'https://blob/original',
					pathname: 'lesson-files/user-1/original.pdf',
					filename: 'ws.pdf',
					contentType: 'application/pdf',
					size: 1234,
					orderIndex: 0
				}
			],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				blobUrl: 'https://blob/original',
				pathname: 'lesson-files/user-1/original.pdf',
				filename: 'ws.pdf',
				contentType: 'application/pdf',
				size: 1234,
				orderIndex: 0
			}
		]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/resources/copy.spec.ts`
Expected: FAIL — `buildCopiedFileRows` still expects a `copies` argument / type error.

- [ ] **Step 3: Update `copy.ts`**

In `src/lib/resources/copy.ts`, replace the `TemplateFile` interface, delete the `CopiedBlob` interface, and rewrite `buildCopiedFileRows`:

```ts
export interface TemplateFile {
	blobUrl: string;
	pathname: string;
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
}

export interface NewFileRow {
	userId: string;
	lessonId: number | null;
	scheduledLessonId: number | null;
	blobUrl: string;
	pathname: string;
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
}

/**
 * Duplicate a template lesson's files onto a scheduled lesson. Blobs are NOT
 * copied — each new row reuses the source blobUrl/pathname, so one blob is
 * shared by reference and reclaimed only when the last row referencing it goes.
 */
export function buildCopiedFileRows(
	files: TemplateFile[],
	userId: string,
	scheduledLessonId: number
): NewFileRow[] {
	return files.map((f) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		blobUrl: f.blobUrl,
		pathname: f.pathname,
		filename: f.filename,
		contentType: f.contentType,
		size: f.size,
		orderIndex: f.orderIndex
	}));
}
```

(Leave `buildCopiedLinkRows`, `TemplateLink`, and `NewLinkRow` unchanged.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/resources/copy.spec.ts`
Expected: PASS. (Typecheck will still fail until Task 4 — that's expected; do not commit yet.)

- [ ] **Step 5: (No commit — continue to Task 4, which restores a green build.)**

---

## Task 4: Share blobs in `copyLessonContent`; add `deleteBlobs`; remove `copyBlob`

**Files:**

- Modify: `src/lib/server/blob.ts`
- Modify: `src/lib/server/queries/schedule.ts:11-12,111-167`

- [ ] **Step 1: Update `blob.ts`**

Replace `src/lib/server/blob.ts` with:

```ts
import { del, head } from '@vercel/blob';
import { env } from '$env/dynamic/private';

// The SDK reads process.env.BLOB_READ_WRITE_TOKEN on Vercel, but Vite's dev
// server does not populate process.env from .env — so we pass the token
// explicitly (sourced from $env, which does see .env) for dev + prod parity.
const token = env.BLOB_READ_WRITE_TOKEN;

/** Delete a blob by its pathname (or url). */
export async function deleteBlob(pathname: string): Promise<void> {
	await del(pathname, { token });
}

/** Delete many blobs by pathname, chunked to stay within API/timeout limits. */
export async function deleteBlobs(pathnames: string[]): Promise<void> {
	if (pathnames.length === 0) return;
	const CHUNK = 100;
	for (let i = 0; i < pathnames.length; i += CHUNK) {
		await del(pathnames.slice(i, i + CHUNK), { token });
	}
}

/** Fetch blob metadata; throws if it does not exist. */
export async function headBlob(url: string) {
	return head(url, { token });
}
```

- [ ] **Step 2: Update `copyLessonContent` in `schedule.ts`**

Remove the `copyBlob` import (line 12: `import { copyBlob } from '$lib/server/blob';`).

Update the docstring above `copyLessonContent` (around line 111) to:

```ts
/**
 * Copy a template lesson's plan + links + files onto a freshly created scheduled
 * lesson. Files reuse the template's blob by reference (no physical copy); the
 * blob is reference-counted and reclaimed only when the last row referencing it
 * is removed. Runs once at schedule time; later edits do not propagate.
 */
```

Replace the `files.length > 0` block (currently lines 157-166, the `copyBlob` + `Promise.all` + insert) with:

```ts
if (files.length > 0) {
	await db.insert(resourceFile).values(buildCopiedFileRows(files, userId, scheduledLessonId));
}
```

(The existing `files` select at lines 145-156 already returns `blobUrl`, `pathname`, `filename`, `contentType`, `size`, `orderIndex` — matching `TemplateFile`.)

- [ ] **Step 3: Typecheck + unit tests (green build restored)**

Run: `bun run check`
Expected: no errors (no remaining references to `copyBlob` / `CopiedBlob`).
Run: `bun run test:unit -- --run`
Expected: PASS (all suites, including the updated `copy.spec.ts`).

- [ ] **Step 4: Commit (Tasks 3 + 4 together)**

```bash
git add src/lib/resources/copy.ts src/lib/resources/copy.spec.ts src/lib/server/blob.ts src/lib/server/queries/schedule.ts
git commit -m "feat: share lesson blobs by reference instead of copying (#1)"
```

---

## Task 5: Cleanup module — `descendantFilePathnames`, `reclaimBlobs`, `deleteAndReclaim`

**Files:**

- Create: `src/lib/server/queries/resource-cleanup.ts`

No new importers yet, so the build stays green. DB behaviour is verified by the e2e in Tasks 7–8.

- [ ] **Step 1: Create the module**

`src/lib/server/queries/resource-cleanup.ts`:

```ts
import { eq, and, inArray } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { resourceFile, module, lesson, klass, scheduledLesson } from '$lib/server/db/schema';
import { deleteBlobs } from '$lib/server/blob';
import { pathnamesToReclaim } from '$lib/resources/reclaim';

/** A node whose deletion cascade may remove resource_file rows. */
export type CascadeRoot =
	| { type: 'lesson'; id: number }
	| { type: 'module'; id: number }
	| { type: 'course'; id: number }
	| { type: 'class'; id: number }
	| { type: 'scheduledLessons'; ids: number[] };

/** Pathnames of this user's resource_file rows where `column` is in `ids`. */
async function filePathnamesIn(
	userId: string,
	column: AnyPgColumn,
	ids: number[]
): Promise<string[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.select({ pathname: resourceFile.pathname })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), inArray(column, ids)));
	return rows.map((r) => r.pathname);
}

/**
 * Every blob pathname that deleting `root` will orphan, by walking the same
 * FK cascade Postgres will. With lesson_id/module_id now `set null`, deleting a
 * module or lesson does NOT reach scheduled lessons — they detach and survive.
 */
export async function descendantFilePathnames(
	userId: string,
	root: CascadeRoot
): Promise<string[]> {
	const out = new Set<string>();
	const add = (paths: string[]) => paths.forEach((p) => out.add(p));

	if (root.type === 'scheduledLessons') {
		add(await filePathnamesIn(userId, resourceFile.scheduledLessonId, root.ids));
		return [...out];
	}
	if (root.type === 'lesson') {
		add(await filePathnamesIn(userId, resourceFile.lessonId, [root.id]));
		return [...out];
	}
	if (root.type === 'class') {
		const sl = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, root.id)));
		add(
			await filePathnamesIn(
				userId,
				resourceFile.scheduledLessonId,
				sl.map((r) => r.id)
			)
		);
		return [...out];
	}
	if (root.type === 'module') {
		const lessons = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, root.id)));
		add(await filePathnamesIn(userId, resourceFile.moduleId, [root.id]));
		add(
			await filePathnamesIn(
				userId,
				resourceFile.lessonId,
				lessons.map((r) => r.id)
			)
		);
		return [...out];
	}
	// course
	const modules = await db
		.select({ id: module.id })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, root.id)));
	const moduleIds = modules.map((r) => r.id);
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
		.where(and(eq(klass.userId, userId), eq(klass.courseId, root.id)));
	const classIds = classes.map((r) => r.id);
	const scheduled =
		classIds.length === 0
			? []
			: await db
					.select({ id: scheduledLesson.id })
					.from(scheduledLesson)
					.where(
						and(eq(scheduledLesson.userId, userId), inArray(scheduledLesson.classId, classIds))
					);
	add(await filePathnamesIn(userId, resourceFile.courseId, [root.id]));
	add(await filePathnamesIn(userId, resourceFile.moduleId, moduleIds));
	add(
		await filePathnamesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((r) => r.id)
		)
	);
	add(
		await filePathnamesIn(
			userId,
			resourceFile.scheduledLessonId,
			scheduled.map((r) => r.id)
		)
	);
	return [...out];
}

/**
 * Delete the blobs among `candidatePathnames` that no resource_file row still
 * references. Call AFTER the rows are deleted. Failures are logged, never
 * thrown: the DB delete already succeeded, and a blob hiccup must not fail the
 * user's action (worst case is a leaked blob, the pre-existing behaviour).
 */
export async function reclaimBlobs(candidatePathnames: string[]): Promise<void> {
	const unique = [...new Set(candidatePathnames)];
	if (unique.length === 0) return;
	try {
		const CHUNK = 100;
		const stillReferenced: string[] = [];
		for (let i = 0; i < unique.length; i += CHUNK) {
			const rows = await db
				.select({ pathname: resourceFile.pathname })
				.from(resourceFile)
				.where(inArray(resourceFile.pathname, unique.slice(i, i + CHUNK)));
			stillReferenced.push(...rows.map((r) => r.pathname));
		}
		await deleteBlobs(pathnamesToReclaim(unique, stillReferenced));
	} catch (err) {
		console.error('reclaimBlobs failed', err);
	}
}

/**
 * Gather the pathnames `root`'s deletion will orphan, run `deleteRows()` (the
 * cascade), then reclaim the now-unreferenced blobs. Ordering is the only
 * safety mechanism — neon-http has no transactions.
 */
export async function deleteAndReclaim(
	userId: string,
	root: CascadeRoot,
	deleteRows: () => Promise<unknown>
): Promise<void> {
	const candidates = await descendantFilePathnames(userId, root);
	await deleteRows();
	await reclaimBlobs(candidates);
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/queries/resource-cleanup.ts
git commit -m "feat: add reference-counted blob cleanup module (#1)"
```

---

## Task 6: Wire all delete paths through the cleanup module

**Files:**

- Modify: `src/lib/server/queries/courses.ts:20-22,62-64,116-118`
- Modify: `src/lib/server/queries/classes.ts:37-39`
- Modify: `src/lib/server/queries/schedule.ts` (`unscheduleModule` ~238-254, `deleteFromSequence` ~400-414)
- Modify: `src/lib/server/queries/resources.ts:6,90-101`

- [ ] **Step 1: `courses.ts`**

Add the import near the top: `import { deleteAndReclaim } from './resource-cleanup';`

Replace the three delete functions:

```ts
export function deleteCourse(userId: string, id: number) {
	return deleteAndReclaim(userId, { type: 'course', id }, () =>
		db.delete(course).where(and(eq(course.userId, userId), eq(course.id, id)))
	);
}
```

```ts
export function deleteModule(userId: string, id: number) {
	return deleteAndReclaim(userId, { type: 'module', id }, () =>
		db.delete(module).where(and(eq(module.userId, userId), eq(module.id, id)))
	);
}
```

```ts
export function deleteLesson(userId: string, id: number) {
	return deleteAndReclaim(userId, { type: 'lesson', id }, () =>
		db.delete(lesson).where(and(eq(lesson.userId, userId), eq(lesson.id, id)))
	);
}
```

- [ ] **Step 2: `classes.ts`**

Add: `import { deleteAndReclaim } from './resource-cleanup';`

```ts
export function deleteClass(userId: string, id: number) {
	return deleteAndReclaim(userId, { type: 'class', id }, () =>
		db.delete(klass).where(and(eq(klass.userId, userId), eq(klass.id, id)))
	);
}
```

- [ ] **Step 3: `schedule.ts` — import + `unscheduleModule` + `deleteFromSequence`**

Add: `import { deleteAndReclaim } from './resource-cleanup';`

Replace `unscheduleModule`'s body:

```ts
export async function unscheduleModule(
	userId: string,
	moduleId: number,
	classId: number,
	today: string = todayIso()
): Promise<void> {
	const rows = await db
		.select({ id: scheduledLesson.id })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.moduleId, moduleId),
				eq(scheduledLesson.classId, classId)
			)
		);
	await deleteAndReclaim(userId, { type: 'scheduledLessons', ids: rows.map((r) => r.id) }, () =>
		db
			.delete(scheduledLesson)
			.where(
				and(
					eq(scheduledLesson.userId, userId),
					eq(scheduledLesson.moduleId, moduleId),
					eq(scheduledLesson.classId, classId)
				)
			)
	);
	await reallocateClass(userId, classId, today);
}
```

Replace `deleteFromSequence`'s delete call (keep the classId lookup and the `reallocateClass` call):

```ts
export async function deleteFromSequence(
	userId: string,
	id: number,
	today: string = todayIso()
): Promise<void> {
	const [row] = await db
		.select({ classId: scheduledLesson.classId })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	if (!row) return;
	await deleteAndReclaim(userId, { type: 'scheduledLessons', ids: [id] }, () =>
		db
			.delete(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)))
	);
	await reallocateClass(userId, row.classId, today);
}
```

- [ ] **Step 4: `resources.ts` — `deleteFile`**

Change the import on line 6 from `import { deleteBlob, headBlob } from '$lib/server/blob';` to `import { headBlob } from '$lib/server/blob';` and add `import { reclaimBlobs } from './resource-cleanup';`.

Replace `deleteFile`:

```ts
/** Delete a file row and reclaim its blob if no other row references it. */
export async function deleteFile(userId: string, id: number): Promise<void> {
	const [row] = await db
		.select({ pathname: resourceFile.pathname })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	if (!row) return;
	await db
		.delete(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	await reclaimBlobs([row.pathname]);
}
```

- [ ] **Step 5: Typecheck + unit tests + lint**

Run: `bun run check` → no errors.
Run: `bun run test:unit -- --run` → PASS.
Run: `bun run lint` → clean (run `bun run format` if it flags formatting).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/queries/courses.ts src/lib/server/queries/classes.ts src/lib/server/queries/schedule.ts src/lib/server/queries/resources.ts
git commit -m "feat: reclaim blobs on every resource delete path (#1)"
```

---

## Task 7: e2e — cascade reclamation (the issue #1 acceptance test)

**Files:**

- Create: `e2e/blob-cleanup.e2e.ts`

- [ ] **Step 1: Refresh the test branch (applies the FK migration)**

Run: `bun run db:test:setup`
Expected: "Test branch ready." (Re-forks `test`, applies committed migrations incl. Task 1's, truncates.)

- [ ] **Step 2: Write the cascade e2e**

`e2e/blob-cleanup.e2e.ts`:

```ts
import { test, expect } from '@playwright/test';

async function signUp(page) {
	const email = `teacher_${Date.now()}@example.com`;
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').first().fill('password1234');
	await page.locator('input[type="password"]').nth(1).fill('password1234');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);
}

/** Create subject → module → lesson, open the lesson, return its URL. */
async function createLessonAndOpen(page, subject: string) {
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: subject }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('Add a lesson to this module').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();
	await page.getByRole('link', { name: 'Open lesson' }).first().click();
	await expect(page.getByLabel('Lesson title')).toHaveValue('L1 Intro');
}

/** Upload a PDF on the current lesson/owner page and return its blob URL. */
async function uploadFile(page, filename: string): Promise<string> {
	await page.locator('input[type="file"]').setInputFiles({
		name: filename,
		mimeType: 'application/pdf',
		buffer: Buffer.from('%PDF-1.4\n% test file\n')
	});
	const link = page.getByRole('link', { name: filename });
	await expect(link).toBeVisible({ timeout: 20000 });
	const url = await link.getAttribute('href');
	expect(url).toMatch(/^https?:\/\//);
	return url as string;
}

test('deleting a subject reclaims its lesson file blobs', async ({ page, request }) => {
	await signUp(page);
	await createLessonAndOpen(page, 'GCSE Physics');
	const blobUrl = await uploadFile(page, 'notes.pdf');

	// Blob exists now.
	expect((await request.get(blobUrl)).ok()).toBe(true);

	// Delete the subject from the courses list.
	await page.goto('/courses');
	await page.getByRole('button', { name: 'Delete subject' }).first().click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);

	// Blob is reclaimed (Vercel Blob serves 404 for a deleted pathname).
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(404);
});
```

- [ ] **Step 3: Run the e2e**

Run: `bun run test:e2e -- blob-cleanup.e2e.ts`
Expected: PASS — the test fails before this phase's changes (blob would still serve 200), passes now.

- [ ] **Step 4: Commit**

```bash
git add e2e/blob-cleanup.e2e.ts
git commit -m "test(e2e): subject delete reclaims lesson file blobs (#1)"
```

---

## Task 8: e2e — reference counting + content decoupling

**Files:**

- Modify: `e2e/blob-cleanup.e2e.ts`

- [ ] **Step 1: Append the reference-counting test**

Add to `e2e/blob-cleanup.e2e.ts` (the helpers from Task 7 are in scope):

```ts
test('shared blob survives template-lesson delete, reclaimed when last reference goes', async ({
	page,
	request
}) => {
	await signUp(page);
	await createLessonAndOpen(page, 'GCSE Biology');
	const blobUrl = await uploadFile(page, 'cells.pdf');

	// Create a class for the subject.
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill('10Bio1');
	await page.locator('select[name="courseId"]').selectOption({ label: 'GCSE Biology' });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByText('10Bio1')).toBeVisible();

	// Assign the module to the class — copies the lesson, sharing the blob.
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Biology' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('button', { name: 'Assign to class' }).click();
	await page.getByRole('button', { name: '10Bio1' }).click();
	await page.getByRole('button', { name: /Assign to 1 class/ }).click();

	// Delete the template lesson. Its scheduled copy still references the blob.
	await page.reload();
	await page.getByRole('button', { name: 'Delete lesson' }).first().click();

	// Shared blob still alive (scheduled copy references it).
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(200);

	// The scheduled lesson survived the template delete (detached).
	await page.goto('/classes');
	await page.getByRole('link', { name: '10Bio1' }).click();
	await expect(page.getByText('L1 Intro')).toBeVisible();

	// Delete the class — removes the last reference; blob is reclaimed.
	await page.goto('/classes');
	await page.getByRole('button', { name: 'Delete class' }).first().click();
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(404);
});
```

> **Note for the implementer:** the button accessible names were verified against the current pages at plan time — `Delete lesson` (`aria-label`, module page), `Delete class` / `Delete subject` (`title=`), `Assign to class` (visible text), `Assign to N class(es)` (matched by `/Assign to 1 class/`). If markup has since changed and a locator doesn't resolve, open the relevant `+page.svelte`, match the actual `title=`/`aria-label`/visible text, and fix the locator — never weaken an assertion to make it pass.

- [ ] **Step 2: Run the e2e**

Run: `bun run test:e2e -- blob-cleanup.e2e.ts`
Expected: PASS (both tests).

- [ ] **Step 3: Commit**

```bash
git add e2e/blob-cleanup.e2e.ts
git commit -m "test(e2e): reference-counted blob survives content delete, reclaimed last (#1)"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run everything**

Run: `bun run check` → no errors.
Run: `bun run lint` → clean.
Run: `bun run test:unit -- --run` → all PASS.
Run: `bun run test:e2e` → all PASS (existing suites + `blob-cleanup`).

- [ ] **Step 2: Confirm no stragglers**

Run: `grep -rn "copyBlob\|CopiedBlob" src/` → no matches.
Run: `grep -rn "deleteBlob\b" src/` → only `blob.ts` (definition); `resources.ts` now uses `reclaimBlobs`.

- [ ] **Step 3: Final commit (if anything was reformatted)**

```bash
git add -A
git commit -m "chore: phase A cleanup + formatting (#1)"
```

---

## Self-review notes (spec coverage)

- **Layer 0 (share blobs):** Tasks 3–4. `copyBlob` removed (Task 4, verified Task 9).
- **Layer 1 (reference-counted reclamation):** Tasks 2, 5, 6. Guard is load-bearing — proven by Task 8 (blob survives template delete).
- **FK `set null` + migration:** Task 1. Decouple proven by Task 8 (scheduled lesson survives, "L1 Intro" still visible).
- **All delete paths wired:** Task 6 (course/module/lesson/class/unscheduleModule/deleteFromSequence/deleteFile).
- **Reclaim race / no-transaction ordering:** `deleteAndReclaim` gathers-then-deletes-then-reclaims; documented in spec, accepted.
- **Out of Phase A:** the reaper (#22), confirmation dialogs (#23), abandoned-upload orphans (#21).
