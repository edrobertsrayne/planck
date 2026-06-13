# Lesson Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every lesson (template and scheduled) its own page with a Milkdown WYSIWYG plan editor, a simple list of resource links, and Vercel Blob file attachments — with content copied (then independent) when a module is scheduled.

**Architecture:** Pure, unit-tested helpers in `src/lib/lesson-content/` (owner discriminator, copy-on-schedule transforms, file validation, reorder). Thin DB query helpers in `src/lib/server/queries/lesson-content.ts` compose those with Drizzle. A `src/lib/server/blob.ts` adapter wraps all Vercel Blob calls. Two SvelteKit pages (template + scheduled) share three Svelte section components. Files upload client-side directly to Blob via a token `+server.ts` route, then a form action records the row.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Drizzle ORM (neon-http — **no transactions, use `db.batch()`**), `@milkdown/crepe`, `@vercel/blob`, Vitest (server=node, client=vitest-browser-svelte), Playwright.

---

## Prerequisites (one-time setup)

- [ ] **Install dependencies**

```bash
bun add @milkdown/crepe @vercel/blob
```

- [ ] **Add the Blob token to `.env`**

Vercel Blob reads `BLOB_READ_WRITE_TOKEN`. Create a Blob store in the Vercel dashboard (Storage → Blob), copy its read-write token, and add to `.env` (and Vercel project env vars):

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

- [ ] **Verify the app still builds**

Run: `bun run check`
Expected: no new errors beyond the pre-existing repo baseline.

---

## Task 1: Database schema

**Files:**

- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Add `plan` to `lesson` and `scheduledLesson`, and add the two attachment tables**

In `src/lib/server/db/schema.ts`, add `plan: text('plan').notNull().default('')` to the `lesson` table object (after `orderIndex`) and to the `scheduledLesson` table object (after `room`).

Then add these two tables **before** the final `export * from './auth.schema';` line:

```ts
export const lessonLink = pgTable('lesson_link', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	// Exactly one of lessonId / scheduledLessonId is set (enforced in app code).
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	url: text('url').notNull(),
	label: text('label'),
	orderIndex: integer('order_index').notNull().default(0)
});

export const lessonFile = pgTable('lesson_file', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	// Exactly one of lessonId / scheduledLessonId is set (enforced in app code).
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	blobUrl: text('blob_url').notNull(),
	pathname: text('pathname').notNull(),
	filename: text('filename').notNull(),
	contentType: text('content_type').notNull(),
	size: integer('size').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});
```

- [ ] **Step 2: Push the schema to the dev database**

Run: `bun run db:push`
Expected: prompts to create `lesson_link`, `lesson_file`, and add `plan` columns; accept. Completes without error.

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(db): add lesson plan column and lesson_link/lesson_file tables"
```

---

## Task 2: Owner discriminator helper (pure)

**Files:**

- Create: `src/lib/lesson-content/owner.ts`
- Test: `src/lib/lesson-content/owner.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ownerColumns, type OwnerRef } from './owner';

describe('ownerColumns', () => {
	it('maps a template lesson owner to the lessonId column', () => {
		expect(ownerColumns({ lessonId: 7 })).toEqual({ lessonId: 7, scheduledLessonId: null });
	});

	it('maps a scheduled lesson owner to the scheduledLessonId column', () => {
		expect(ownerColumns({ scheduledLessonId: 9 })).toEqual({
			lessonId: null,
			scheduledLessonId: 9
		});
	});

	it('throws when neither id is provided', () => {
		expect(() => ownerColumns({} as OwnerRef)).toThrow(/exactly one/);
	});

	it('throws when both ids are provided', () => {
		expect(() => ownerColumns({ lessonId: 1, scheduledLessonId: 2 } as OwnerRef)).toThrow(
			/exactly one/
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/lesson-content/owner.spec.ts`
Expected: FAIL — cannot find module `./owner`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lesson-content/owner.ts

/** Which lesson a link/file is attached to. Exactly one variant is ever set. */
export type OwnerRef = { lessonId: number } | { scheduledLessonId: number };

export interface OwnerColumns {
	lessonId: number | null;
	scheduledLessonId: number | null;
}

/**
 * Map an owner reference to the (lessonId, scheduledLessonId) column pair for an
 * insert. Throws unless exactly one side is set — this is the invariant that
 * keeps every lesson_link / lesson_file row attached to a single owner.
 */
export function ownerColumns(owner: OwnerRef): OwnerColumns {
	const lessonId = 'lessonId' in owner && owner.lessonId != null ? owner.lessonId : null;
	const scheduledLessonId =
		'scheduledLessonId' in owner && owner.scheduledLessonId != null
			? owner.scheduledLessonId
			: null;
	if ((lessonId === null) === (scheduledLessonId === null)) {
		throw new Error('ownerColumns: exactly one of lessonId / scheduledLessonId is required');
	}
	return { lessonId, scheduledLessonId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/lesson-content/owner.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lesson-content/owner.ts src/lib/lesson-content/owner.spec.ts
git commit -m "feat(lessons): owner discriminator helper"
```

---

## Task 3: Copy-on-schedule transforms (pure)

**Files:**

- Create: `src/lib/lesson-content/copy.ts`
- Test: `src/lib/lesson-content/copy.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildCopiedLinkRows, buildCopiedFileRows } from './copy';

describe('buildCopiedLinkRows', () => {
	it('repoints template links to a scheduled lesson, preserving order/labels', () => {
		const rows = buildCopiedLinkRows(
			[
				{ url: 'https://a.com', label: 'A', orderIndex: 0 },
				{ url: 'https://b.com', label: null, orderIndex: 1 }
			],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				url: 'https://a.com',
				label: 'A',
				orderIndex: 0
			},
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				url: 'https://b.com',
				label: null,
				orderIndex: 1
			}
		]);
	});
});

describe('buildCopiedFileRows', () => {
	it('pairs each template file with its copied blob, preserving metadata', () => {
		const rows = buildCopiedFileRows(
			[{ filename: 'ws.pdf', contentType: 'application/pdf', size: 1234, orderIndex: 0 }],
			[{ blobUrl: 'https://blob/new', pathname: 'lesson-files/user-1/new.pdf' }],
			'user-1',
			42
		);
		expect(rows).toEqual([
			{
				userId: 'user-1',
				lessonId: null,
				scheduledLessonId: 42,
				blobUrl: 'https://blob/new',
				pathname: 'lesson-files/user-1/new.pdf',
				filename: 'ws.pdf',
				contentType: 'application/pdf',
				size: 1234,
				orderIndex: 0
			}
		]);
	});

	it('throws when files and copies lengths differ', () => {
		expect(() => buildCopiedFileRows([], [{ blobUrl: 'x', pathname: 'y' }], 'u', 1)).toThrow(
			/length mismatch/
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/lesson-content/copy.spec.ts`
Expected: FAIL — cannot find module `./copy`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lesson-content/copy.ts

export interface TemplateLink {
	url: string;
	label: string | null;
	orderIndex: number;
}

export interface NewLinkRow {
	userId: string;
	lessonId: number | null;
	scheduledLessonId: number | null;
	url: string;
	label: string | null;
	orderIndex: number;
}

/** Duplicate a template lesson's links, repointed at a new scheduled lesson. */
export function buildCopiedLinkRows(
	links: TemplateLink[],
	userId: string,
	scheduledLessonId: number
): NewLinkRow[] {
	return links.map((l) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		url: l.url,
		label: l.label,
		orderIndex: l.orderIndex
	}));
}

export interface TemplateFile {
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
}

export interface CopiedBlob {
	blobUrl: string;
	pathname: string;
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
 * Duplicate a template lesson's files. `copies[i]` is the already-copied blob
 * for `files[i]`; the two arrays are parallel and must be the same length.
 */
export function buildCopiedFileRows(
	files: TemplateFile[],
	copies: CopiedBlob[],
	userId: string,
	scheduledLessonId: number
): NewFileRow[] {
	if (files.length !== copies.length) {
		throw new Error('buildCopiedFileRows: files/copies length mismatch');
	}
	return files.map((f, i) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		blobUrl: copies[i].blobUrl,
		pathname: copies[i].pathname,
		filename: f.filename,
		contentType: f.contentType,
		size: f.size,
		orderIndex: f.orderIndex
	}));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/lesson-content/copy.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lesson-content/copy.ts src/lib/lesson-content/copy.spec.ts
git commit -m "feat(lessons): copy-on-schedule row transforms"
```

---

## Task 4: File validation + reorder (pure)

**Files:**

- Create: `src/lib/lesson-content/files.ts`
- Test: `src/lib/lesson-content/files.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { validateFile, applyOrder, MAX_FILE_BYTES, ALLOWED_CONTENT_TYPES } from './files';

describe('validateFile', () => {
	it('accepts an allowed type within the size limit', () => {
		expect(validateFile({ contentType: 'application/pdf', size: 1000 })).toEqual({ ok: true });
	});

	it('rejects a disallowed content type', () => {
		const r = validateFile({ contentType: 'application/x-msdownload', size: 1000 });
		expect(r.ok).toBe(false);
	});

	it('rejects a file over the size limit', () => {
		const r = validateFile({ contentType: 'application/pdf', size: MAX_FILE_BYTES + 1 });
		expect(r.ok).toBe(false);
	});

	it('exposes the allowlist including pdf and png', () => {
		expect(ALLOWED_CONTENT_TYPES).toContain('application/pdf');
		expect(ALLOWED_CONTENT_TYPES).toContain('image/png');
	});
});

describe('applyOrder', () => {
	it('assigns sequential orderIndex values from the given id order', () => {
		expect(applyOrder([5, 2, 9])).toEqual([
			{ id: 5, orderIndex: 0 },
			{ id: 2, orderIndex: 1 },
			{ id: 9, orderIndex: 2 }
		]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/lesson-content/files.spec.ts`
Expected: FAIL — cannot find module `./files`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lesson-content/files.ts

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_CONTENT_TYPES = [
	'application/pdf',
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.spreadsheet',
	'application/vnd.oasis.opendocument.presentation',
	'text/plain'
] as const;

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateFile(input: { contentType: string; size: number }): ValidateResult {
	if (
		!ALLOWED_CONTENT_TYPES.includes(input.contentType as (typeof ALLOWED_CONTENT_TYPES)[number])
	) {
		return { ok: false, error: `File type not allowed: ${input.contentType}` };
	}
	if (input.size > MAX_FILE_BYTES) {
		return { ok: false, error: `File exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit` };
	}
	return { ok: true };
}

/** Turn an ordered list of ids into {id, orderIndex} pairs for a reorder write. */
export function applyOrder(orderedIds: number[]): { id: number; orderIndex: number }[] {
	return orderedIds.map((id, orderIndex) => ({ id, orderIndex }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/lesson-content/files.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lesson-content/files.ts src/lib/lesson-content/files.spec.ts
git commit -m "feat(lessons): file validation and reorder helpers"
```

---

## Task 5: Blob adapter

**Files:**

- Create: `src/lib/server/blob.ts`

No unit test (thin wrapper over `@vercel/blob`; mocked in component/query tests). Verified by `bun run check`.

- [ ] **Step 1: Write the adapter**

```ts
// src/lib/server/blob.ts
import { copy, del, head } from '@vercel/blob';

/** Copy an existing blob to a new pathname; returns the new url + pathname. */
export async function copyBlob(fromUrl: string, toPathname: string) {
	const result = await copy(fromUrl, toPathname, { access: 'public' });
	return { blobUrl: result.url, pathname: result.pathname };
}

/** Delete a blob by its pathname (or url). */
export async function deleteBlob(pathname: string): Promise<void> {
	await del(pathname);
}

/** Fetch blob metadata; throws if it does not exist. */
export async function headBlob(url: string) {
	return head(url);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/blob.ts
git commit -m "feat(lessons): vercel blob adapter"
```

---

## Task 6: Lesson getters (template + scheduled)

**Files:**

- Modify: `src/lib/server/queries/courses.ts`
- Modify: `src/lib/server/queries/schedule.ts`

No unit test (DB-coupled, matches existing untested query convention). Verified by `bun run check` and later by the pages.

- [ ] **Step 1: Add `getLesson` to `courses.ts`**

Add to `src/lib/server/queries/courses.ts` (the import line at top already imports `course, module, lesson`):

```ts
/** A template lesson with its module + course context for the lesson page. */
export async function getLesson(userId: string, id: number) {
	const [row] = await db
		.select({
			id: lesson.id,
			title: lesson.title,
			plan: lesson.plan,
			moduleId: lesson.moduleId,
			moduleName: module.name,
			courseId: module.courseId,
			courseName: course.name
		})
		.from(lesson)
		.innerJoin(module, eq(lesson.moduleId, module.id))
		.innerJoin(course, eq(module.courseId, course.id))
		.where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
	return row ?? null;
}
```

- [ ] **Step 2: Add `getScheduledLesson` to `schedule.ts`**

Add to `src/lib/server/queries/schedule.ts` (top import already has `scheduledLesson, klass, course`):

```ts
/** A scheduled lesson with its class + course context for the lesson page. */
export async function getScheduledLesson(userId: string, id: number) {
	const [row] = await db
		.select({
			id: scheduledLesson.id,
			title: scheduledLesson.title,
			plan: scheduledLesson.plan,
			classId: scheduledLesson.classId,
			className: klass.name,
			courseName: course.name
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	return row ?? null;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/queries/courses.ts src/lib/server/queries/schedule.ts
git commit -m "feat(lessons): getters for template and scheduled lessons"
```

---

## Task 7: Lesson-content query module (links, files, plan)

**Files:**

- Create: `src/lib/server/queries/lesson-content.ts`

No unit test (DB-coupled; pure parts already tested in Tasks 2–4). Verified by `bun run check` and pages.

- [ ] **Step 1: Write the query module**

```ts
// src/lib/server/queries/lesson-content.ts
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson, lessonLink, lessonFile } from '$lib/server/db/schema';
import { ownerColumns, type OwnerRef } from '$lib/lesson-content/owner';
import { applyOrder } from '$lib/lesson-content/files';
import { deleteBlob, headBlob } from '$lib/server/blob';

// --- owner where-clause helpers (branch on which side of the discriminator) ---
function linkOwnerEq(owner: OwnerRef) {
	return 'lessonId' in owner
		? eq(lessonLink.lessonId, owner.lessonId)
		: eq(lessonLink.scheduledLessonId, owner.scheduledLessonId);
}
function fileOwnerEq(owner: OwnerRef) {
	return 'lessonId' in owner
		? eq(lessonFile.lessonId, owner.lessonId)
		: eq(lessonFile.scheduledLessonId, owner.scheduledLessonId);
}

// --- plan ---
export function saveLessonPlan(userId: string, owner: OwnerRef, plan: string) {
	return 'lessonId' in owner
		? db
				.update(lesson)
				.set({ plan })
				.where(and(eq(lesson.userId, userId), eq(lesson.id, owner.lessonId)))
		: db
				.update(scheduledLesson)
				.set({ plan })
				.where(
					and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, owner.scheduledLessonId))
				);
}

// --- links ---
export function listLinks(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(lessonLink)
		.where(and(eq(lessonLink.userId, userId), linkOwnerEq(owner)))
		.orderBy(lessonLink.orderIndex);
}

export async function addLink(userId: string, owner: OwnerRef, url: string, label: string | null) {
	const cols = ownerColumns(owner);
	const existing = await listLinks(userId, owner);
	return db.insert(lessonLink).values({
		userId,
		...cols,
		url,
		label: label && label.length > 0 ? label : null,
		orderIndex: existing.length
	});
}

export function deleteLink(userId: string, id: number) {
	return db.delete(lessonLink).where(and(eq(lessonLink.userId, userId), eq(lessonLink.id, id)));
}

export async function reorderLinks(userId: string, orderedIds: number[]) {
	const updates = applyOrder(orderedIds).map((o) =>
		db
			.update(lessonLink)
			.set({ orderIndex: o.orderIndex })
			.where(and(eq(lessonLink.userId, userId), eq(lessonLink.id, o.id)))
	);
	if (updates.length > 0) {
		await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
	}
}

// --- files ---
export function listFiles(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), fileOwnerEq(owner)))
		.orderBy(lessonFile.orderIndex);
}

export async function addFile(
	userId: string,
	owner: OwnerRef,
	file: { blobUrl: string; pathname: string; filename: string; contentType: string; size: number }
) {
	const cols = ownerColumns(owner);
	// Confirm the blob actually exists before recording it (the client reported it).
	await headBlob(file.blobUrl);
	const existing = await listFiles(userId, owner);
	return db.insert(lessonFile).values({ userId, ...cols, ...file, orderIndex: existing.length });
}

/** Delete a file row and its blob. Looks up pathname first (scoped to user). */
export async function deleteFile(userId: string, id: number): Promise<void> {
	const [row] = await db
		.select({ pathname: lessonFile.pathname })
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), eq(lessonFile.id, id)));
	if (!row) return;
	await deleteBlob(row.pathname);
	await db.delete(lessonFile).where(and(eq(lessonFile.userId, userId), eq(lessonFile.id, id)));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/queries/lesson-content.ts
git commit -m "feat(lessons): lesson-content query module (plan/links/files)"
```

---

## Task 8: Wire copy-on-schedule into `assignModule`

**Files:**

- Modify: `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Add a content-copy helper and call it from `assignModule`**

At the top of `src/lib/server/queries/schedule.ts`, extend the schema import and add new imports:

```ts
import {
	scheduledLesson,
	klass,
	course,
	lesson,
	lessonLink,
	lessonFile
} from '$lib/server/db/schema';
import { buildCopiedLinkRows, buildCopiedFileRows } from '$lib/lesson-content/copy';
import { copyBlob } from '$lib/server/blob';
```

Add this helper (e.g. above `assignModule`):

```ts
/**
 * Copy a template lesson's plan + links + files onto a freshly created scheduled
 * lesson. Blobs are physically copied so the two are fully independent. Runs once
 * at schedule time; later edits on either side do not propagate.
 */
async function copyLessonContent(
	userId: string,
	templateLessonId: number,
	scheduledLessonId: number
): Promise<void> {
	const [tpl] = await db
		.select({ plan: lesson.plan })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.id, templateLessonId)));
	if (tpl?.plan) {
		await db
			.update(scheduledLesson)
			.set({ plan: tpl.plan })
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, scheduledLessonId)));
	}

	const links = await db
		.select({ url: lessonLink.url, label: lessonLink.label, orderIndex: lessonLink.orderIndex })
		.from(lessonLink)
		.where(and(eq(lessonLink.userId, userId), eq(lessonLink.lessonId, templateLessonId)))
		.orderBy(lessonLink.orderIndex);
	if (links.length > 0) {
		await db.insert(lessonLink).values(buildCopiedLinkRows(links, userId, scheduledLessonId));
	}

	const files = await db
		.select({
			blobUrl: lessonFile.blobUrl,
			pathname: lessonFile.pathname,
			filename: lessonFile.filename,
			contentType: lessonFile.contentType,
			size: lessonFile.size,
			orderIndex: lessonFile.orderIndex
		})
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), eq(lessonFile.lessonId, templateLessonId)))
		.orderBy(lessonFile.orderIndex);
	if (files.length > 0) {
		const copies = await Promise.all(
			files.map((f) =>
				copyBlob(f.blobUrl, `lesson-files/${userId}/${crypto.randomUUID()}-${f.filename}`)
			)
		);
		await db
			.insert(lessonFile)
			.values(buildCopiedFileRows(files, copies, userId, scheduledLessonId));
	}
}
```

- [ ] **Step 2: Call it after inserting the scheduled rows in `assignModule`**

In `assignModule`, the current code does a single bulk `db.insert(scheduledLesson).values(lessons.map(...))`. Replace that bulk insert with a per-lesson insert that returns the new id, then copy content. Replace:

```ts
await db.insert(scheduledLesson).values(
	lessons.map((l, i) => ({
		userId,
		classId,
		lessonId: l.id,
		moduleId,
		title: l.title,
		orderIndex: next + i,
		date: null,
		period: null,
		room: ''
	}))
);
```

with:

```ts
for (let i = 0; i < lessons.length; i++) {
	const l = lessons[i];
	const [inserted] = await db
		.insert(scheduledLesson)
		.values({
			userId,
			classId,
			lessonId: l.id,
			moduleId,
			title: l.title,
			orderIndex: next + i,
			date: null,
			period: null,
			room: ''
		})
		.returning({ id: scheduledLesson.id });
	await copyLessonContent(userId, l.id, inserted.id);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 4: Run the full unit suite (copy transforms exercised by Task 3 tests)**

Run: `bun run test:unit -- --run`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/queries/schedule.ts
git commit -m "feat(lessons): copy plan/links/files when scheduling a module"
```

---

## Task 9: Upload token route

**Files:**

- Create: `src/routes/api/lesson-files/upload/+server.ts`

- [ ] **Step 1: Write the route**

The client sends `clientPayload` as JSON `{ ownerType: 'lesson' | 'scheduled', ownerId: number }`. The route verifies the signed-in user owns that lesson before issuing a token, and restricts type/size.

```ts
// src/routes/api/lesson-files/upload/+server.ts
import { json, error } from '@sveltejs/kit';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson } from '$lib/server/db/schema';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from '$lib/lesson-content/files';

async function userOwnsTarget(
	userId: string,
	ownerType: string,
	ownerId: number
): Promise<boolean> {
	if (ownerType === 'lesson') {
		const [row] = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(and(eq(lesson.userId, userId), eq(lesson.id, ownerId)));
		return !!row;
	}
	if (ownerType === 'scheduled') {
		const [row] = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, ownerId)));
		return !!row;
	}
	return false;
}

export const POST: RequestHandler = async (event) => {
	const userId = requireUserId(event);
	const body = (await event.request.json()) as HandleUploadBody;

	const result = await handleUpload({
		body,
		request: event.request,
		onBeforeGenerateToken: async (_pathname, clientPayload) => {
			const payload = JSON.parse(clientPayload ?? '{}') as { ownerType?: string; ownerId?: number };
			if (!payload.ownerType || !payload.ownerId) throw error(400, 'Missing owner');
			const owns = await userOwnsTarget(userId, payload.ownerType, payload.ownerId);
			if (!owns) throw error(403, 'Not your lesson');
			return {
				allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
				maximumSizeInBytes: MAX_FILE_BYTES,
				addRandomSuffix: true
			};
		},
		// Not used (no public webhook on localhost); the client records the row via a form action.
		onUploadCompleted: async () => {}
	});

	return json(result);
};
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/lesson-files/upload/+server.ts
git commit -m "feat(lessons): blob upload token route with ownership check"
```

---

## Task 10: `LessonPlanEditor.svelte` (Milkdown Crepe)

**Files:**

- Create: `src/lib/components/LessonPlanEditor.svelte`
- Test: `src/lib/components/LessonPlanEditor.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

// Mock Crepe so the test does not mount a real ProseMirror instance.
vi.mock('@milkdown/crepe', () => {
	return {
		Crepe: class {
			create() {
				return Promise.resolve();
			}
			getMarkdown() {
				return '# Edited';
			}
			destroy() {}
		}
	};
});

import LessonPlanEditor from './LessonPlanEditor.svelte';

test('renders an editor container and a Save button', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	await expect.element(screen.getByRole('button', { name: 'Save plan' })).toBeInTheDocument();
});

test('submits the current markdown in a hidden field on save', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	const hidden = screen.container.querySelector('input[name="plan"]') as HTMLInputElement;
	await expect.element(screen.getByRole('button', { name: 'Save plan' })).toBeInTheDocument();
	expect(hidden).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/LessonPlanEditor.svelte.test.ts`
Expected: FAIL — cannot find module `./LessonPlanEditor.svelte`.

- [ ] **Step 3: Write the component**

The editor mounts client-side only, syncs Markdown into a hidden input before submit, and posts to `saveAction` via a normal enhanced form.

```svelte
<!-- src/lib/components/LessonPlanEditor.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';

	let { value = '', saveAction }: { value?: string; saveAction: string } = $props();

	let editorEl: HTMLDivElement;
	let markdown = $state(value);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let crepe: any = null;

	onMount(async () => {
		const { Crepe } = await import('@milkdown/crepe');
		await import('@milkdown/crepe/theme/common/style.css');
		await import('@milkdown/crepe/theme/frame.css');
		crepe = new Crepe({ root: editorEl, defaultValue: value });
		await crepe.create();
	});

	onDestroy(() => {
		crepe?.destroy();
	});

	function syncMarkdown() {
		if (crepe) markdown = crepe.getMarkdown();
	}
</script>

<form
	method="POST"
	action={saveAction}
	use:enhance
	onsubmit={syncMarkdown}
	class="flex flex-col gap-3"
>
	<div bind:this={editorEl} class="rounded-card border border-line bg-white"></div>
	<input type="hidden" name="plan" bind:value={markdown} />
	<div class="flex justify-end">
		<Button type="submit">Save plan</Button>
	</div>
</form>
```

Note: `onsubmit` runs `syncMarkdown()` before `use:enhance` serializes the form, so the hidden input holds the latest Markdown.

- [ ] **Step 4: Validate the component with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool on the component source. Fix anything it reports and re-run until clean.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/LessonPlanEditor.svelte.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LessonPlanEditor.svelte src/lib/components/LessonPlanEditor.svelte.test.ts
git commit -m "feat(lessons): Milkdown plan editor component"
```

---

## Task 11: `LessonLinks.svelte`

**Files:**

- Create: `src/lib/components/LessonLinks.svelte`
- Test: `src/lib/components/LessonLinks.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import LessonLinks from './LessonLinks.svelte';

const links = [
	{ id: 1, url: 'https://youtube.com/watch?v=x', label: 'Intro video' },
	{ id: 2, url: 'https://example.com', label: null }
];

test('renders each link with its label or url as text, opening in a new tab', async () => {
	const screen = render(LessonLinks, { links });
	const a = screen.getByRole('link', { name: 'Intro video' });
	await expect.element(a).toHaveAttribute('href', 'https://youtube.com/watch?v=x');
	await expect.element(a).toHaveAttribute('target', '_blank');
	await expect
		.element(screen.getByRole('link', { name: 'https://example.com' }))
		.toBeInTheDocument();
});

test('renders an add-link form with url and label fields', async () => {
	const screen = render(LessonLinks, { links: [] });
	await expect.element(screen.getByPlaceholder('https://…')).toBeInTheDocument();
	await expect.element(screen.getByRole('button', { name: 'Add link' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/LessonLinks.svelte.test.ts`
Expected: FAIL — cannot find module `./LessonLinks.svelte`.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/LessonLinks.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from './Button.svelte';
	import Field from './Field.svelte';
	import EmptyState from './EmptyState.svelte';

	type Link = { id: number; url: string; label: string | null };
	let { links }: { links: Link[] } = $props();
</script>

{#if links.length === 0}
	<EmptyState message="No links attached yet." />
{:else}
	<ul class="mb-4 flex flex-col gap-1.5">
		{#each links as link (link.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<a
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 truncate text-pink-dk hover:underline"
				>
					{link.label ?? link.url}
				</a>
				<form method="POST" action="?/deleteLink" use:enhance>
					<input type="hidden" name="id" value={link.id} />
					<Button type="submit" variant="danger" size="sm">Remove</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<form method="POST" action="?/addLink" use:enhance class="flex items-end gap-3">
	<Field label="URL">
		<input
			name="url"
			type="url"
			required
			placeholder="https://…"
			class="w-72 rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
	</Field>
	<Field label="Label (optional)">
		<input
			name="label"
			placeholder="Intro video"
			class="rounded-control border border-line bg-field px-3 py-2 text-sm"
		/>
	</Field>
	<Button type="submit">Add link</Button>
</form>
```

- [ ] **Step 4: Validate with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool; fix and re-run until clean.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/LessonLinks.svelte.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LessonLinks.svelte src/lib/components/LessonLinks.svelte.test.ts
git commit -m "feat(lessons): links section component"
```

---

## Task 12: `LessonFiles.svelte`

**Files:**

- Create: `src/lib/components/LessonFiles.svelte`
- Test: `src/lib/components/LessonFiles.svelte.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('@vercel/blob/client', () => ({
	upload: vi.fn().mockResolvedValue({
		url: 'https://blob/new',
		pathname: 'lesson-files/u/new.pdf',
		contentType: 'application/pdf'
	})
}));

import LessonFiles from './LessonFiles.svelte';

const files = [
	{
		id: 1,
		filename: 'worksheet.pdf',
		blobUrl: 'https://blob/ws',
		contentType: 'application/pdf',
		size: 2048
	}
];

test('lists each file as a download link with a remove button', async () => {
	const screen = render(LessonFiles, { files, ownerType: 'lesson', ownerId: 5 });
	await expect
		.element(screen.getByRole('link', { name: 'worksheet.pdf' }))
		.toHaveAttribute('href', 'https://blob/ws');
	await expect.element(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
});

test('shows a file input for uploading', async () => {
	const screen = render(LessonFiles, { files: [], ownerType: 'scheduled', ownerId: 9 });
	const input = screen.container.querySelector('input[type="file"]');
	expect(input).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- --run src/lib/components/LessonFiles.svelte.test.ts`
Expected: FAIL — cannot find module `./LessonFiles.svelte`.

- [ ] **Step 3: Write the component**

Upload goes directly to Blob via the token route, then the returned metadata is posted to `?/addFile` to create the row, then the page reloads via `invalidateAll`.

```svelte
<!-- src/lib/components/LessonFiles.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from './Button.svelte';
	import EmptyState from './EmptyState.svelte';
	import { validateFile } from '$lib/lesson-content/files';

	type FileRow = {
		id: number;
		filename: string;
		blobUrl: string;
		contentType: string;
		size: number;
	};
	let {
		files,
		ownerType,
		ownerId
	}: { files: FileRow[]; ownerType: 'lesson' | 'scheduled'; ownerId: number } = $props();

	let uploading = $state(false);
	let errorMsg = $state('');

	async function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		errorMsg = '';

		const check = validateFile({ contentType: file.type, size: file.size });
		if (!check.ok) {
			errorMsg = check.error;
			input.value = '';
			return;
		}

		uploading = true;
		try {
			const { upload } = await import('@vercel/blob/client');
			const blob = await upload(file.name, file, {
				access: 'public',
				handleUploadUrl: '/api/lesson-files/upload',
				clientPayload: JSON.stringify({ ownerType, ownerId })
			});

			const body = new FormData();
			body.set('blobUrl', blob.url);
			body.set('pathname', blob.pathname);
			body.set('filename', file.name);
			body.set('contentType', blob.contentType || file.type);
			body.set('size', String(file.size));
			await fetch('?/addFile', { method: 'POST', body });
			await invalidateAll();
		} catch {
			errorMsg = 'Upload failed. Please try again.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

{#if files.length === 0}
	<EmptyState message="No files attached yet." />
{:else}
	<ul class="mb-4 flex flex-col gap-1.5">
		{#each files as file (file.id)}
			<li class="flex items-center gap-2 rounded-card border border-line bg-white px-4 py-2.5">
				<a
					href={file.blobUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="flex-1 truncate text-pink-dk hover:underline"
				>
					{file.filename}
				</a>
				<span class="text-xs text-muted">{Math.round(file.size / 1024)} KB</span>
				<form method="POST" action="?/deleteFile" use:enhance>
					<input type="hidden" name="id" value={file.id} />
					<Button type="submit" variant="danger" size="sm">Remove</Button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<label class="inline-flex cursor-pointer items-center gap-2">
	<span
		class="rounded-control border border-line bg-field px-3 py-2 text-sm font-medium hover:border-pink-200"
	>
		{uploading ? 'Uploading…' : 'Upload file'}
	</span>
	<input type="file" class="sr-only" onchange={onFileChange} disabled={uploading} />
</label>
{#if errorMsg}
	<p class="mt-2 text-sm text-danger">{errorMsg}</p>
{/if}
```

- [ ] **Step 4: Validate with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool; fix and re-run until clean.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:unit -- --run src/lib/components/LessonFiles.svelte.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LessonFiles.svelte src/lib/components/LessonFiles.svelte.test.ts
git commit -m "feat(lessons): files section component with client-side blob upload"
```

---

## Task 13: Template lesson page

**Files:**

- Create: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.server.ts`
- Create: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.svelte`

- [ ] **Step 1: Write the page server (load + actions)**

```ts
// .../lessons/[lessonId]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getLesson } from '$lib/server/queries/courses';
import {
	saveLessonPlan,
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/lesson-content';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const lessonId = Number(event.params.lessonId);
	const lesson = await getLesson(userId, lessonId);
	if (!lesson) throw error(404, 'Lesson not found');
	return {
		lesson,
		links: await listLinks(userId, { lessonId }),
		files: await listFiles(userId, { lessonId })
	};
};

export const actions: Actions = {
	savePlan: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await saveLessonPlan(
			userId,
			{ lessonId: Number(event.params.lessonId) },
			String(form.get('plan'))
		);
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ lessonId: Number(event.params.lessonId) },
			String(form.get('url')),
			form.get('label') ? String(form.get('label')) : null
		);
	},
	deleteLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteLink(userId, Number(form.get('id')));
	},
	addFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addFile(
			userId,
			{ lessonId: Number(event.params.lessonId) },
			{
				blobUrl: String(form.get('blobUrl')),
				pathname: String(form.get('pathname')),
				filename: String(form.get('filename')),
				contentType: String(form.get('contentType')),
				size: Number(form.get('size'))
			}
		);
	},
	deleteFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFile(userId, Number(form.get('id')));
	}
};
```

- [ ] **Step 2: Write the page**

```svelte
<!-- .../lessons/[lessonId]/+page.svelte -->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import LessonPlanEditor from '$lib/components/LessonPlanEditor.svelte';
	import LessonLinks from '$lib/components/LessonLinks.svelte';
	import LessonFiles from '$lib/components/LessonFiles.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<a
	href="/courses/{data.lesson.courseId}/modules/{data.lesson.moduleId}"
	class="text-sm font-medium text-pink-dk hover:underline">← {data.lesson.moduleName}</a
>
<PageHeader title={data.lesson.title} subtitle={data.lesson.courseName} />

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Lesson plan</h2>
	<LessonPlanEditor value={data.lesson.plan} saveAction="?/savePlan" />
</Card>

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<LessonLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<LessonFiles files={data.files} ownerType="lesson" ownerId={data.lesson.id} />
</Card>
```

- [ ] **Step 3: Validate the page with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool on `+page.svelte`; fix and re-run until clean.

- [ ] **Step 4: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons"
git commit -m "feat(lessons): template lesson page"
```

---

## Task 14: Scheduled lesson page

**Files:**

- Create: `src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.server.ts`
- Create: `src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.svelte`

- [ ] **Step 1: Write the page server (load + actions)**

Identical action shape to Task 13, but the owner is `{ scheduledLessonId }` and it loads via `getScheduledLesson`.

```ts
// .../lessons/[scheduledLessonId]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getScheduledLesson } from '$lib/server/queries/schedule';
import {
	saveLessonPlan,
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/lesson-content';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const scheduledLessonId = Number(event.params.scheduledLessonId);
	const lesson = await getScheduledLesson(userId, scheduledLessonId);
	if (!lesson) throw error(404, 'Lesson not found');
	return {
		lesson,
		links: await listLinks(userId, { scheduledLessonId }),
		files: await listFiles(userId, { scheduledLessonId })
	};
};

export const actions: Actions = {
	savePlan: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await saveLessonPlan(
			userId,
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
			String(form.get('plan'))
		);
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
			String(form.get('url')),
			form.get('label') ? String(form.get('label')) : null
		);
	},
	deleteLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteLink(userId, Number(form.get('id')));
	},
	addFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addFile(
			userId,
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
			{
				blobUrl: String(form.get('blobUrl')),
				pathname: String(form.get('pathname')),
				filename: String(form.get('filename')),
				contentType: String(form.get('contentType')),
				size: Number(form.get('size'))
			}
		);
	},
	deleteFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFile(userId, Number(form.get('id')));
	}
};
```

- [ ] **Step 2: Write the page**

```svelte
<!-- .../lessons/[scheduledLessonId]/+page.svelte -->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import LessonPlanEditor from '$lib/components/LessonPlanEditor.svelte';
	import LessonLinks from '$lib/components/LessonLinks.svelte';
	import LessonFiles from '$lib/components/LessonFiles.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<a href="/classes/{data.lesson.classId}" class="text-sm font-medium text-pink-dk hover:underline"
	>← {data.lesson.className}</a
>
<PageHeader title={data.lesson.title} subtitle={data.lesson.courseName} />

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Lesson plan</h2>
	<LessonPlanEditor value={data.lesson.plan} saveAction="?/savePlan" />
</Card>

<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<LessonLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<LessonFiles files={data.files} ownerType="scheduled" ownerId={data.lesson.id} />
</Card>
```

- [ ] **Step 3: Validate the page with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool on `+page.svelte`; fix and re-run until clean.

- [ ] **Step 4: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/classes/[classId]/lessons"
git commit -m "feat(lessons): scheduled lesson page"
```

---

## Task 15: Entry points (link to the lesson pages)

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`
- Modify: `src/routes/(app)/classes/[classId]/+page.svelte`

- [ ] **Step 1: Make template lesson titles link to their page**

In `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`, replace the title `<span>` (currently lines ~46–48):

```svelte
<span class="text-ink"><span class="font-semibold text-muted">{i + 1}.</span> {l.title}</span>
```

with a link to the lesson page (the module exposes `data.module.courseId` and `data.module.id`):

```svelte
<a
	href="/courses/{data.module.courseId}/modules/{data.module.id}/lessons/{l.id}"
	class="text-ink hover:underline"
	><span class="font-semibold text-muted">{i + 1}.</span> {l.title}</a
>
```

- [ ] **Step 2: Add an "Open" link to each scheduled lesson on the class page**

In `src/routes/(app)/classes/[classId]/+page.svelte`, inside the hover action group (the `<div class="flex items-center gap-2 opacity-0 ...">` block, currently ~line 128), add an anchor before the "+ Blank above" form:

```svelte
<a
	href="/classes/{data.klass.id}/lessons/{item.id}"
	class="rounded-control border border-line px-2 py-1 text-xs font-medium hover:border-pink-200"
	>Open</a
>
```

- [ ] **Step 3: Validate both pages with the Svelte autofixer**

Use the `svelte-autofixer` MCP tool on each modified `+page.svelte`; fix and re-run until clean.

- [ ] **Step 4: Verify it compiles**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte" "src/routes/(app)/classes/[classId]/+page.svelte"
git commit -m "feat(lessons): link module + class pages to lesson pages"
```

---

## Task 16: E2E happy path

**Files:**

- Create: `e2e/lesson-page.e2e.ts`

The existing Playwright config (`playwright.config.ts`) uses `testMatch: '**/*.e2e.{ts,js}'`, so the file **must** be named `*.e2e.ts` to be discovered. There is no seeded-session helper — `e2e/happy-path.test.ts` signs up through the UI; mirror that. This test creates its own data through the UI, navigates to the template lesson page via the link added in Task 15, types a plan, saves, adds a link, and asserts persistence after reload.

- [ ] **Step 1: Write the happy-path test**

```ts
import { test, expect } from '@playwright/test';

test('edit a lesson plan and attach a link from the lesson page', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up.
	await page.goto('/signup');
	await page.getByPlaceholder('Name').fill('Test Teacher');
	await page.getByPlaceholder('Email').fill(email);
	await page.getByPlaceholder('Password').fill('password123');
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Course → module → lesson.
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Forces').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('L1: Intro to forces').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();

	// Open the lesson page via its title link (added in Task 15).
	await page.getByRole('link', { name: /L1 Intro/ }).click();
	await expect(page.getByRole('heading', { name: 'L1 Intro' })).toBeVisible();

	// Type into the Milkdown editor (mounts client-side) and save.
	const editor = page.locator('.milkdown [contenteditable="true"]');
	await editor.click();
	await editor.pressSequentially('Lesson objectives: understand forces.');
	await page.getByRole('button', { name: 'Save plan' }).click();

	// Add a link.
	await page.getByPlaceholder('https://…').fill('https://youtube.com/watch?v=abc');
	await page.getByRole('button', { name: 'Add link' }).click();
	await expect(page.getByRole('link', { name: 'https://youtube.com/watch?v=abc' })).toBeVisible();

	// Reload and assert persistence.
	await page.reload();
	await expect(page.getByRole('link', { name: 'https://youtube.com/watch?v=abc' })).toBeVisible();
	await expect(page.locator('.milkdown')).toContainText('understand forces');
});
```

- [ ] **Step 2: Run the e2e test**

Run: `bun run test:e2e`
Expected: PASS (requires a reachable dev DB; this path does not touch Blob).

- [ ] **Step 3: Commit**

```bash
git add e2e/lesson-page.e2e.ts
git commit -m "test(lessons): e2e happy path for plan + links"
```

---

## Final verification

- [ ] **Run the full unit suite**

Run: `bun run test:unit -- --run`
Expected: PASS.

- [ ] **Run type + lint checks**

Run: `bun run check && bun run lint`
Expected: no new errors.

- [ ] **Manual smoke test** (per the verify/run skills)

Start the app, open a template lesson page, write a plan, add a link, upload a small PDF, then schedule that module to a class and confirm the scheduled lesson page shows a copied (independent) plan/link/file.

---

## Notes for the implementer

- **neon-http has no transactions.** Use `db.batch()` for atomic multi-statement writes (see `reorderLinks`). Single statements are fine alone.
- **The editor is client-only.** Never import `@milkdown/crepe` at module top level in a `.svelte` file — only inside `onMount`, as written. SSR has no DOM.
- **Blob ownership is enforced server-side** in the token route (`onBeforeGenerateToken`) and again in query helpers via `userId` scoping. Do not trust the client payload beyond what those checks allow.
- **Copy-on-schedule is one-time.** After `assignModule` runs, template and scheduled content are fully independent by design — do not add re-sync.
