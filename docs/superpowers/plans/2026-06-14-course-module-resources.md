# Course & Module Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers attach links and files to courses and modules, reusing the existing lesson-resource machinery generalised from 2 owner types to 4.

**Architecture:** The `OwnerRef` discriminated union grows from `{lessonId}|{scheduledLessonId}` to also include `{courseId}|{moduleId}`. The `lesson_link`/`lesson_file` tables are physically renamed to `resource_link`/`resource_file` and gain nullable `course_id`/`module_id` FK columns (cascade). Lesson-content code is renamed to a generic "resource" vocabulary. Course and module pages get two cards (Links, Files) and the four resource form actions.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle ORM on Neon (`neon-http` driver — **no transactions**, use `db.batch()`), Vercel Blob, Vitest, Playwright, bun.

**Spec:** `docs/superpowers/specs/2026-06-14-course-module-resources-design.md`

---

## File Structure

**Renamed/moved:**

- `src/lib/lesson-content/{owner,files,copy}.ts` (+ `.spec.ts`) → `src/lib/resources/…`
- `src/lib/components/LessonLinks.svelte` → `ResourceLinks.svelte` (+ test)
- `src/lib/components/LessonFiles.svelte` → `ResourceFiles.svelte` (+ test)
- `src/routes/api/lesson-files/upload/+server.ts` → `src/routes/api/resource-files/upload/+server.ts`

**Modified:**

- `src/lib/server/db/schema.ts` — rename tables, add columns
- `src/lib/server/queries/lesson-content.ts` — slim to `saveLessonPlan` only
- `src/lib/server/queries/schedule.ts` — renamed symbols/import path
- `src/routes/(app)/courses/[courseId]/+page.{server.ts,svelte}` — resources
- `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.{server.ts,svelte}` — resources + reorder
- The two lesson pages — import/prop renames only

**Created:**

- `src/lib/server/queries/resources.ts` — generic links/files CRUD (4 owners)
- `scripts/migrate-resource-rename.ts` — one-off DB migration runner

**Conventions:** the `DATABASE_URL` lives in `.env.local`. Verification commands: `bun run check`, `bun run lint`, `bun run test:unit -- --run`, `bun run db:push`.

---

## Task 1: Rename lib dir `lesson-content` → `resources` (mechanical, no behaviour change)

**Files:**

- Move: `src/lib/lesson-content/{owner,owner.spec,files,files.spec,copy,copy.spec}.ts` → `src/lib/resources/…`
- Modify imports in: `src/lib/server/queries/lesson-content.ts`, `src/lib/server/queries/schedule.ts`, `src/lib/components/LessonFiles.svelte`, `src/routes/api/lesson-files/upload/+server.ts`

- [ ] **Step 1: Move the directory with git**

```bash
cd /home/ed/Projects/planck
git mv src/lib/lesson-content src/lib/resources
```

- [ ] **Step 2: Update the four import paths**

```bash
grep -rl "\$lib/lesson-content/" src/ | xargs sed -i 's#\$lib/lesson-content/#$lib/resources/#g'
```

Affected lines become:

- `src/lib/server/queries/lesson-content.ts`: `from '$lib/resources/owner'`, `from '$lib/resources/files'`
- `src/lib/server/queries/schedule.ts`: `from '$lib/resources/copy'`
- `src/lib/components/LessonFiles.svelte`: `from '$lib/resources/files'`
- `src/routes/api/lesson-files/upload/+server.ts`: `from '$lib/resources/files'`

- [ ] **Step 3: Verify nothing references the old path and the project still checks**

Run: `grep -rn "lesson-content/" src/ ; bun run check`
Expected: grep prints nothing (the `queries/lesson-content.ts` filename has no trailing slash, so won't match); `check` passes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move lesson-content lib dir to resources"
```

---

## Task 2: Rename DB tables, add owner columns, update schema + symbols

The breaking symbol rename + the live migration, done together so the build stays green at the commit.

**Files:**

- Create: `scripts/migrate-resource-rename.ts`
- Modify: `src/lib/server/db/schema.ts`, `src/lib/server/queries/lesson-content.ts`, `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Confirm the existing FK/constraint names**

```bash
cd /home/ed/Projects/planck
URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
DATABASE_URL="$URL" bun -e '
const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const r = await sql`select conname, conrelid::regclass::text as tbl from pg_constraint where conrelid::regclass::text in ('"'"'lesson_link'"'"','"'"'lesson_file'"'"') order by tbl, conname`;
console.log(r);
'
```

Expected names (Drizzle convention `<table>_<col>_<reftbl>_<refcol>_fk`):
`lesson_link_lesson_id_lesson_id_fk`, `lesson_link_scheduled_lesson_id_scheduled_lesson_id_fk`,
`lesson_file_lesson_id_lesson_id_fk`, `lesson_file_scheduled_lesson_id_scheduled_lesson_id_fk`,
plus `lesson_link_pkey` / `lesson_file_pkey`. If any differ, adjust the script in Step 2.

- [ ] **Step 2: Write the idempotent migration runner**

Create `scripts/migrate-resource-rename.ts`:

```ts
/**
 * One-off, idempotent migration: rename lesson_link/lesson_file to
 * resource_link/resource_file, rename their constraints/sequences to the new
 * prefix, and add nullable course_id/module_id FK columns (ON DELETE CASCADE).
 *
 * Run once:  DATABASE_URL=... bun run scripts/migrate-resource-rename.ts
 * Safe to re-run (every statement is guarded).
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const sql = neon(url);

// Each entry is one complete SQL statement (a DO block counts as one statement).
const statements: string[] = [
	// 1. Rename tables (IF EXISTS → no-op if already renamed). Rows preserved.
	`ALTER TABLE IF EXISTS lesson_link RENAME TO resource_link`,
	`ALTER TABLE IF EXISTS lesson_file RENAME TO resource_file`,

	// 2. Rename sequences + primary keys to the new prefix.
	`ALTER SEQUENCE IF EXISTS lesson_link_id_seq RENAME TO resource_link_id_seq`,
	`ALTER SEQUENCE IF EXISTS lesson_file_id_seq RENAME TO resource_file_id_seq`,
	`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_pkey') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_pkey TO resource_link_pkey;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_pkey') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_pkey TO resource_file_pkey;
		END IF;
	END $$`,

	// 3. Rename the existing FK constraints to the new prefix.
	`DO $$ BEGIN
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_lesson_id_lesson_id_fk') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_lesson_id_lesson_id_fk TO resource_link_lesson_id_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_link_scheduled_lesson_id_scheduled_lesson_id_fk') THEN
			ALTER TABLE resource_link RENAME CONSTRAINT lesson_link_scheduled_lesson_id_scheduled_lesson_id_fk TO resource_link_scheduled_lesson_id_scheduled_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_lesson_id_lesson_id_fk') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_lesson_id_lesson_id_fk TO resource_file_lesson_id_lesson_id_fk;
		END IF;
		IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lesson_file_scheduled_lesson_id_scheduled_lesson_id_fk') THEN
			ALTER TABLE resource_file RENAME CONSTRAINT lesson_file_scheduled_lesson_id_scheduled_lesson_id_fk TO resource_file_scheduled_lesson_id_scheduled_lesson_id_fk;
		END IF;
	END $$`,

	// 4. Add new owner columns (nullable).
	`ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS course_id integer`,
	`ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS module_id integer`,
	`ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS course_id integer`,
	`ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS module_id integer`,

	// 5. Add their FK constraints with Drizzle-convention names (cascade).
	`DO $$ BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_link_course_id_course_id_fk') THEN
			ALTER TABLE resource_link ADD CONSTRAINT resource_link_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_link_module_id_module_id_fk') THEN
			ALTER TABLE resource_link ADD CONSTRAINT resource_link_module_id_module_id_fk FOREIGN KEY (module_id) REFERENCES module(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_file_course_id_course_id_fk') THEN
			ALTER TABLE resource_file ADD CONSTRAINT resource_file_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE;
		END IF;
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='resource_file_module_id_module_id_fk') THEN
			ALTER TABLE resource_file ADD CONSTRAINT resource_file_module_id_module_id_fk FOREIGN KEY (module_id) REFERENCES module(id) ON DELETE CASCADE;
		END IF;
	END $$`
];

for (const stmt of statements) {
	await sql.query(stmt);
	console.log('ok:', stmt.split('\n')[0].slice(0, 70));
}
console.log('migration complete');
```

- [ ] **Step 3: Run the migration**

```bash
cd /home/ed/Projects/planck
URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
DATABASE_URL="$URL" bun run scripts/migrate-resource-rename.ts
```

Expected: one `ok:` line per statement, then `migration complete`. Re-running prints the same (idempotent).

- [ ] **Step 4: Update `schema.ts` — rename both tables and add columns**

In `src/lib/server/db/schema.ts`, replace the `lessonLink` and `lessonFile` definitions with:

```ts
export const resourceLink = pgTable('resource_link', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	// Exactly one of lessonId / scheduledLessonId / courseId / moduleId is set
	// (enforced in app code via ownerColumns()).
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	courseId: integer('course_id').references(() => course.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id').references(() => module.id, { onDelete: 'cascade' }),
	url: text('url').notNull(),
	label: text('label'),
	orderIndex: integer('order_index').notNull().default(0)
});

export const resourceFile = pgTable('resource_file', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull(),
	// Exactly one of lessonId / scheduledLessonId / courseId / moduleId is set.
	lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
	scheduledLessonId: integer('scheduled_lesson_id').references(() => scheduledLesson.id, {
		onDelete: 'cascade'
	}),
	courseId: integer('course_id').references(() => course.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id').references(() => module.id, { onDelete: 'cascade' }),
	blobUrl: text('blob_url').notNull(),
	pathname: text('pathname').notNull(),
	filename: text('filename').notNull(),
	contentType: text('content_type').notNull(),
	size: integer('size').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});
```

- [ ] **Step 5: Update symbol references in `queries/lesson-content.ts` and `queries/schedule.ts`**

(The query-module split happens in Task 3 — for now just rename the symbols in place so the build stays green.)

```bash
cd /home/ed/Projects/planck
sed -i 's/\blessonLink\b/resourceLink/g; s/\blessonFile\b/resourceFile/g' \
  src/lib/server/queries/lesson-content.ts \
  src/lib/server/queries/schedule.ts
```

Confirm the schema `import { … }` lines in both files now name `resourceLink, resourceFile`.

- [ ] **Step 6: Verify build + DB are in sync**

Run: `bun run check`
Expected: 0 errors.

Run:

```bash
URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
DATABASE_URL="$URL" bun run db:push
```

Expected: drizzle-kit reports **No changes detected** (or only trivial no-ops). If it proposes dropping/creating `resource_*` tables or renaming constraints, stop — a name in the migration didn't match; fix Step 2/4 and re-run.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): rename lesson_link/file to resource_*, add course/module owner columns"
```

---

## Task 3: Extend `OwnerRef` to four variants and split the query module

Owner extension and the query split land in **one commit**: once `OwnerRef` is 4-way, the old 2-way branch helpers in `lesson-content.ts` no longer type-check, so they are replaced by the new generic `resources.ts` at the same time.

**Files:**

- Test: `src/lib/resources/owner.spec.ts`
- Modify: `src/lib/resources/owner.ts`
- Create: `src/lib/server/queries/resources.ts`
- Modify: `src/lib/server/queries/lesson-content.ts` (reduce to `saveLessonPlan`)
- Modify: the two lesson page servers' imports

- [ ] **Step 1: Write the failing owner tests**

Replace `src/lib/resources/owner.spec.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { ownerColumns, type OwnerRef } from './owner';

describe('ownerColumns', () => {
	it('maps a template lesson owner to the lessonId column', () => {
		expect(ownerColumns({ lessonId: 7 })).toEqual({
			lessonId: 7,
			scheduledLessonId: null,
			courseId: null,
			moduleId: null
		});
	});

	it('maps a scheduled lesson owner to the scheduledLessonId column', () => {
		expect(ownerColumns({ scheduledLessonId: 9 })).toEqual({
			lessonId: null,
			scheduledLessonId: 9,
			courseId: null,
			moduleId: null
		});
	});

	it('maps a course owner to the courseId column', () => {
		expect(ownerColumns({ courseId: 3 })).toEqual({
			lessonId: null,
			scheduledLessonId: null,
			courseId: 3,
			moduleId: null
		});
	});

	it('maps a module owner to the moduleId column', () => {
		expect(ownerColumns({ moduleId: 5 })).toEqual({
			lessonId: null,
			scheduledLessonId: null,
			courseId: null,
			moduleId: 5
		});
	});

	it('throws when no id is provided', () => {
		expect(() => ownerColumns({} as OwnerRef)).toThrow(/exactly one/);
	});

	it('throws when more than one id is provided', () => {
		expect(() => ownerColumns({ lessonId: 1, courseId: 2 } as OwnerRef)).toThrow(/exactly one/);
	});
});
```

- [ ] **Step 2: Run the owner tests, verify they fail**

Run: `bun run test:unit -- --run src/lib/resources/owner.spec.ts`
Expected: FAIL — the course/module cases return objects without `courseId`/`moduleId` keys. (Vitest only loads `owner.ts`, so the temporarily-inconsistent `lesson-content.ts` doesn't block this run.)

- [ ] **Step 3: Implement the 4-way owner**

Replace `src/lib/resources/owner.ts` with:

```ts
/** Which entity a link/file is attached to. Exactly one variant is ever set. */
export type OwnerRef =
	| { lessonId: number }
	| { scheduledLessonId: number }
	| { courseId: number }
	| { moduleId: number };

export interface OwnerColumns {
	lessonId: number | null;
	scheduledLessonId: number | null;
	courseId: number | null;
	moduleId: number | null;
}

/**
 * Map an owner reference to the FK column set for an insert. Throws unless
 * exactly one side is set — the invariant that keeps every resource_link /
 * resource_file row attached to a single owner.
 */
export function ownerColumns(owner: OwnerRef): OwnerColumns {
	const cols: OwnerColumns = {
		lessonId: 'lessonId' in owner && owner.lessonId != null ? owner.lessonId : null,
		scheduledLessonId:
			'scheduledLessonId' in owner && owner.scheduledLessonId != null
				? owner.scheduledLessonId
				: null,
		courseId: 'courseId' in owner && owner.courseId != null ? owner.courseId : null,
		moduleId: 'moduleId' in owner && owner.moduleId != null ? owner.moduleId : null
	};
	const setCount = [cols.lessonId, cols.scheduledLessonId, cols.courseId, cols.moduleId].filter(
		(v) => v !== null
	).length;
	if (setCount !== 1) {
		throw new Error(
			'ownerColumns: exactly one of lessonId / scheduledLessonId / courseId / moduleId is required'
		);
	}
	return cols;
}
```

- [ ] **Step 4: Run the owner tests, verify they pass**

Run: `bun run test:unit -- --run src/lib/resources/owner.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Create `src/lib/server/queries/resources.ts`**

The existing generic CRUD, with the owner-branch helpers extended to four variants:

```ts
import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { resourceLink, resourceFile } from '$lib/server/db/schema';
import { ownerColumns, type OwnerRef } from '$lib/resources/owner';
import { applyOrder } from '$lib/resources/files';
import { deleteBlob, headBlob } from '$lib/server/blob';

// --- owner where-clause helpers (branch on which discriminator is set) ---
function linkOwnerEq(owner: OwnerRef) {
	if ('lessonId' in owner) return eq(resourceLink.lessonId, owner.lessonId);
	if ('scheduledLessonId' in owner)
		return eq(resourceLink.scheduledLessonId, owner.scheduledLessonId);
	if ('courseId' in owner) return eq(resourceLink.courseId, owner.courseId);
	return eq(resourceLink.moduleId, owner.moduleId);
}
function fileOwnerEq(owner: OwnerRef) {
	if ('lessonId' in owner) return eq(resourceFile.lessonId, owner.lessonId);
	if ('scheduledLessonId' in owner)
		return eq(resourceFile.scheduledLessonId, owner.scheduledLessonId);
	if ('courseId' in owner) return eq(resourceFile.courseId, owner.courseId);
	return eq(resourceFile.moduleId, owner.moduleId);
}

// --- links ---
export function listLinks(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(resourceLink)
		.where(and(eq(resourceLink.userId, userId), linkOwnerEq(owner)))
		.orderBy(resourceLink.orderIndex);
}

export async function addLink(userId: string, owner: OwnerRef, url: string, label: string | null) {
	const cols = ownerColumns(owner);
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${resourceLink.orderIndex}) + 1, 0)` })
		.from(resourceLink)
		.where(and(eq(resourceLink.userId, userId), linkOwnerEq(owner)));
	return db.insert(resourceLink).values({
		userId,
		...cols,
		url,
		label: label && label.length > 0 ? label : null,
		orderIndex: next
	});
}

export function deleteLink(userId: string, id: number) {
	return db
		.delete(resourceLink)
		.where(and(eq(resourceLink.userId, userId), eq(resourceLink.id, id)));
}

export async function reorderLinks(userId: string, orderedIds: number[]) {
	const updates = applyOrder(orderedIds).map((o) =>
		db
			.update(resourceLink)
			.set({ orderIndex: o.orderIndex })
			.where(and(eq(resourceLink.userId, userId), eq(resourceLink.id, o.id)))
	);
	if (updates.length > 0) {
		await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
	}
}

// --- files ---
export function listFiles(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), fileOwnerEq(owner)))
		.orderBy(resourceFile.orderIndex);
}

export async function addFile(
	userId: string,
	owner: OwnerRef,
	file: { blobUrl: string; pathname: string; filename: string; contentType: string; size: number }
) {
	const cols = ownerColumns(owner);
	// Confirm the blob actually exists before recording it (the client reported it).
	await headBlob(file.blobUrl);
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${resourceFile.orderIndex}) + 1, 0)` })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), fileOwnerEq(owner)));
	return db.insert(resourceFile).values({ userId, ...cols, ...file, orderIndex: next });
}

/** Delete a file row and its blob. Looks up pathname first (scoped to user). */
export async function deleteFile(userId: string, id: number): Promise<void> {
	const [row] = await db
		.select({ pathname: resourceFile.pathname })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	if (!row) return;
	await db
		.delete(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	await deleteBlob(row.pathname);
}
```

- [ ] **Step 6: Slim `src/lib/server/queries/lesson-content.ts` down to `saveLessonPlan`**

Replace the entire file with:

```ts
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson } from '$lib/server/db/schema';
import { type OwnerRef } from '$lib/resources/owner';

/** Save the free-text plan for a template lesson or a scheduled lesson. */
export function saveLessonPlan(userId: string, owner: OwnerRef, plan: string) {
	if ('lessonId' in owner) {
		return db
			.update(lesson)
			.set({ plan })
			.where(and(eq(lesson.userId, userId), eq(lesson.id, owner.lessonId)));
	}
	if ('scheduledLessonId' in owner) {
		return db
			.update(scheduledLesson)
			.set({ plan })
			.where(
				and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, owner.scheduledLessonId))
			);
	}
	throw new Error('saveLessonPlan: owner must be a lesson or scheduled lesson');
}
```

- [ ] **Step 7: Repoint the two lesson page servers' imports**

In `src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.server.ts`
and `src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.server.ts`, replace the single `lesson-content` import block with:

```ts
import { saveLessonPlan } from '$lib/server/queries/lesson-content';
import {
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/resources';
```

- [ ] **Step 8: Verify the whole project type-checks and tests pass**

Run: `bun run check && bun run test:unit -- --run src/lib/resources/`
Expected: 0 type errors; resources specs pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(resources): 4-way OwnerRef + split generic resources query module"
```

---

## Task 4: Rename upload route + add course/module ownership

**Files:**

- Move: `src/routes/api/lesson-files/upload/+server.ts` → `src/routes/api/resource-files/upload/+server.ts`
- Modify the moved file (ownership) and `src/lib/components/LessonFiles.svelte` (URL)

- [ ] **Step 1: Move the route**

```bash
cd /home/ed/Projects/planck
mkdir -p src/routes/api/resource-files/upload
git mv src/routes/api/lesson-files/upload/+server.ts src/routes/api/resource-files/upload/+server.ts
rmdir src/routes/api/lesson-files/upload src/routes/api/lesson-files 2>/dev/null || true
```

- [ ] **Step 2: Teach `userOwnsTarget` about course and module owners**

In `src/routes/api/resource-files/upload/+server.ts`, change the schema import to include `course, module`:

```ts
import { lesson, scheduledLesson, course, module } from '$lib/server/db/schema';
```

Replace `userOwnsTarget` with:

```ts
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
	if (ownerType === 'course') {
		const [row] = await db
			.select({ id: course.id })
			.from(course)
			.where(and(eq(course.userId, userId), eq(course.id, ownerId)));
		return !!row;
	}
	if (ownerType === 'module') {
		const [row] = await db
			.select({ id: module.id })
			.from(module)
			.where(and(eq(module.userId, userId), eq(module.id, ownerId)));
		return !!row;
	}
	return false;
}
```

Also change the ownership error string from `'Not your lesson'` to `'Not your resource'`.

- [ ] **Step 3: Point the upload component at the new route**

In `src/lib/components/LessonFiles.svelte`, change:

```ts
handleUploadUrl: '/api/resource-files/upload',
```

- [ ] **Step 4: Verify**

Run: `grep -rn "lesson-files" src/ ; bun run check`
Expected: grep prints nothing; `check` passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(upload): rename route to resource-files, allow course/module owners"
```

---

## Task 5: Rename components to `Resource*` and widen `ownerType`

**Files:**

- Move: `LessonLinks.svelte`→`ResourceLinks.svelte`, `LessonFiles.svelte`→`ResourceFiles.svelte` (+ their `.test.ts`)
- Modify: both lesson `+page.svelte` files

- [ ] **Step 1: Move the four files**

```bash
cd /home/ed/Projects/planck/src/lib/components
git mv LessonLinks.svelte ResourceLinks.svelte
git mv LessonLinks.svelte.test.ts ResourceLinks.svelte.test.ts
git mv LessonFiles.svelte ResourceFiles.svelte
git mv LessonFiles.svelte.test.ts ResourceFiles.svelte.test.ts
```

- [ ] **Step 2: Widen the `ResourceFiles` ownerType prop**

In `src/lib/components/ResourceFiles.svelte`, change the props type:

```ts
let {
	files,
	ownerType,
	ownerId
}: {
	files: FileRow[];
	ownerType: 'lesson' | 'scheduled' | 'course' | 'module';
	ownerId: number;
} = $props();
```

- [ ] **Step 3: Update the renamed tests (import + add course/module cases)**

In `src/lib/components/ResourceLinks.svelte.test.ts`, change the import to `import ResourceLinks from './ResourceLinks.svelte';` and replace every `LessonLinks` reference with `ResourceLinks`.

Replace `src/lib/components/ResourceFiles.svelte.test.ts` with:

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

import ResourceFiles from './ResourceFiles.svelte';

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
	const screen = render(ResourceFiles, { files, ownerType: 'lesson', ownerId: 5 });
	await expect
		.element(screen.getByRole('link', { name: 'worksheet.pdf' }))
		.toHaveAttribute('href', 'https://blob/ws');
	await expect.element(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
});

test('shows a file input for uploading on a course owner', async () => {
	const screen = render(ResourceFiles, { files: [], ownerType: 'course', ownerId: 3 });
	const input = screen.container.querySelector('input[type="file"]');
	expect(input).not.toBeNull();
});

test('renders for a module owner', async () => {
	const screen = render(ResourceFiles, { files: [], ownerType: 'module', ownerId: 7 });
	const input = screen.container.querySelector('input[type="file"]');
	expect(input).not.toBeNull();
});
```

- [ ] **Step 4: Update imports in both lesson `+page.svelte` files**

In `…/lessons/[lessonId]/+page.svelte` and `…/lessons/[scheduledLessonId]/+page.svelte`, change the two component imports:

```svelte
import ResourceLinks from '$lib/components/ResourceLinks.svelte'; import ResourceFiles from
'$lib/components/ResourceFiles.svelte';
```

and in the markup rename the tags `<LessonLinks … />` → `<ResourceLinks … />` and `<LessonFiles … />` → `<ResourceFiles … />` (keep the existing `ownerType`/`ownerId` props unchanged).

- [ ] **Step 5: Verify**

Run: `grep -rn "LessonLinks\|LessonFiles" src/ ; bun run check && bun run test:unit -- --run src/lib/components/`
Expected: grep prints nothing; check passes; component tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(components): rename Lesson{Links,Files} to Resource{Links,Files}"
```

---

## Task 6: Course page — load resources, add actions, render cards

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/+page.server.ts`
- Modify: `src/routes/(app)/courses/[courseId]/+page.svelte`

- [ ] **Step 1: Extend the course loader + add the four actions**

In `src/routes/(app)/courses/[courseId]/+page.server.ts`, add the import:

```ts
import {
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/resources';
```

Change `load`'s return to include resources:

```ts
return {
	course,
	modules: await listModules(userId, courseId),
	links: await listLinks(userId, { courseId }),
	files: await listFiles(userId, { courseId })
};
```

Add these four actions to the `actions` object (alongside `create`/`rename`/`delete`/`reorder`):

```ts
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ courseId: Number(event.params.courseId) },
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
			{ courseId: Number(event.params.courseId) },
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
```

- [ ] **Step 2: Render the two resource cards on the course page**

In `src/routes/(app)/courses/[courseId]/+page.svelte`, add imports:

```ts
import ResourceLinks from '$lib/components/ResourceLinks.svelte';
import ResourceFiles from '$lib/components/ResourceFiles.svelte';
```

After the existing "Add module" `<Card>…</Card>` block (the last element on the page), append:

```svelte
<Card class="mt-8 mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<ResourceLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<ResourceFiles files={data.files} ownerType="course" ownerId={data.course.id} />
</Card>
```

- [ ] **Step 3: Run the Svelte autofixer on the edited page**

Use the `mcp__svelte__svelte-autofixer` tool on `src/routes/(app)/courses/[courseId]/+page.svelte`; apply any fixes it returns and re-run until clean.

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(courses): attach links and files to a course"
```

---

## Task 7: Module page — load resources, add actions, reorder layout, render cards

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.server.ts`
- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`

- [ ] **Step 1: Extend the module loader + add the four actions**

In `…/modules/[moduleId]/+page.server.ts`, add the import:

```ts
import {
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/resources';
```

Add to `load`'s return object (alongside `module`, `lessons`, `classes`):

```ts
		links: await listLinks(userId, { moduleId }),
		files: await listFiles(userId, { moduleId })
```

Add these four actions alongside the existing `create`/`rename`/`delete`/`reorder`/`assign`:

```ts
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ moduleId: Number(event.params.moduleId) },
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
			{ moduleId: Number(event.params.moduleId) },
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
```

- [ ] **Step 2: Reorder the module page and add resource cards**

In `…/modules/[moduleId]/+page.svelte`:

1. Add imports:

```ts
import ResourceLinks from '$lib/components/ResourceLinks.svelte';
import ResourceFiles from '$lib/components/ResourceFiles.svelte';
```

2. **Move** the entire existing `<Card>…Schedule this module…</Card>` block so it sits immediately **after** the `<PageHeader … />` line (above the `{#if data.lessons.length === 0}` block). Change its opening tag to `<Card class="mb-8">` so it has a bottom margin.

3. The "Add lesson" `<Card class="mb-8">` stays where it is (after the lessons list). After it, append the two resource cards:

```svelte
<Card class="mb-6">
	<h2 class="mb-3 font-display text-lg font-semibold">Links</h2>
	<ResourceLinks links={data.links} />
</Card>

<Card>
	<h2 class="mb-3 font-display text-lg font-semibold">Files</h2>
	<ResourceFiles files={data.files} ownerType="module" ownerId={data.module.id} />
</Card>
```

Resulting top-to-bottom order: back-link → PageHeader → **Schedule this module** → lessons list (or empty state) → Add lesson → **Links** → **Files**.

- [ ] **Step 3: Run the Svelte autofixer on the edited page**

Use `mcp__svelte__svelte-autofixer` on `…/modules/[moduleId]/+page.svelte`; apply fixes until clean. (Watch for the moved block introducing a stray duplicate or unbalanced tag.)

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(modules): attach links/files, move Schedule card to top"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint, type-check, unit tests**

Run: `bun run check && bun run lint && bun run test:unit -- --run`
Expected: all pass, 0 errors. (If `lint` reports prettier formatting, run `bun run format` and amend the last commit.)

- [ ] **Step 2: Confirm DB and schema agree**

Run:

```bash
URL=$(grep -E '^DATABASE_URL=' .env.local | head -1 | sed 's/^DATABASE_URL=//; s/^"//; s/"$//')
DATABASE_URL="$URL" bun run db:push
```

Expected: **No changes detected**.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run `bun run dev`, then: open a course → add a link and upload a file under the modules list → reload, confirm both persist and the file downloads. Repeat on a module page, and confirm "Schedule this module" is now at the top. Delete the course → confirm no error (rows cascade).

- [ ] **Step 4: Final commit if formatting changed**

```bash
git add -A && git commit -m "chore: formatting" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** lib rename (Task 1); data model + migration + `db:push` clean (Task 2); 4-way `OwnerRef` + query split (Task 3); upload route + course/module ownership (Task 4); component rename + `ownerType` widen (Task 5); course page (Task 6); module page + reorder (Task 7); testing — owner 4-way (Task 3 Step 1), component course/module cases (Task 5 Step 3); final verification (Task 8). No e2e — matches spec.
- **Sequencing:** every task ends on a green `bun run check`. The owner extension and query split are one task (Task 3) because a 4-way `OwnerRef` invalidates the old 2-way helpers; Task 2 keeps the build green by renaming symbols in place first.
- **Out of scope (spec):** orphan-blob on cascade delete — tracked in GitHub issue #1; not addressed here.
- **Type consistency:** `ownerColumns` returns `{lessonId, scheduledLessonId, courseId, moduleId}` at every call site; `ResourceFiles` `ownerType` is `'lesson'|'scheduled'|'course'|'module'` in the component, the upload route's `userOwnsTarget`, and all usages (`course`/`module` on the new pages).
- **`copy.ts` unchanged:** it builds only `{lessonId, scheduledLessonId}` rows for the scheduled-lesson copy path; the new `course_id`/`module_id` columns are nullable, so omitting them from those inserts is valid.
