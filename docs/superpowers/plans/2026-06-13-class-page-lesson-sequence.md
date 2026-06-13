# Class Page with Editable Lesson Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-class page (reachable from Agenda, Calendar, Classes) showing the class's upcoming lessons as an ordered, editable sequence with drag-and-drop reorder, insert-a-blank, delete, and inline rename.

**Architecture:** Invert the current "frozen placement" model. The ordered sequence of `scheduled_lesson` rows per class (`orderIndex`) becomes the source of truth; a single pure function `allocateSequence` maps the sequence onto the class's future timetabled-slot stream. A thin `reallocateClass` DB wrapper persists allocations. Sequence edits and timetable edits both call reallocation. Overflow (more lessons than slots) is held as rows with `null` date/period and self-heals when slots free up.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle ORM (Postgres/Neon, `drizzle-kit push` workflow), Vitest, `svelte-dnd-action` (new dependency).

**Key conventions observed in this repo:**
- Pure scheduling logic lives in `src/lib/scheduling/*` with co-located `*.spec.ts` (Vitest). DB query functions in `src/lib/server/queries/*` have **no** unit tests — they are verified via `bun run check` and the app.
- Reorder pattern (`reorderLessons`/`reorderModules`): submit a comma-joined `orderedIds` string to a `?/reorder` form action; renumber sequentially inside `db.transaction`. **No unique constraint on `orderIndex`** (so sequential UPDATEs don't collide mid-transaction). This plan follows that — it does NOT add a unique constraint on `orderIndex`.
- Form actions use `use:enhance`. Page loads use `requireUserId(event)`.

---

### Task 1: Schema change + backfill `orderIndex`

Make `scheduled_lesson` a sequence: add `orderIndex`, make `date`/`period`/`lessonId`/`moduleId` nullable. Then backfill `orderIndex` for any existing rows.

**Files:**
- Modify: `src/lib/server/db/schema.ts:101-124`
- Create: `scripts/backfill-order-index.ts`

- [ ] **Step 1: Edit the `scheduledLesson` table definition**

Replace the `scheduledLesson` definition (currently lines 101-124) with:

```ts
export const scheduledLesson = pgTable(
	'scheduled_lesson',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		classId: integer('class_id')
			.notNull()
			.references(() => klass.id, { onDelete: 'cascade' }),
		// Nullable: null = a blank inserted spacer with no underlying lesson template.
		lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
		moduleId: integer('module_id').references(() => module.id, { onDelete: 'cascade' }),
		// Sequence position within the class. The class's ordered list is the source of truth.
		orderIndex: integer('order_index').notNull().default(0),
		// Nullable: null = overflow (not yet allocated to a timetabled slot).
		date: date('date', { mode: 'string' }),
		period: integer('period'),
		title: text('title').notNull(),
		room: text('room').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.classId, t.date, t.period)]
);
```

- [ ] **Step 2: Push the schema change**

Run: `bun run db:push`
Expected: prompts/confirms adding `order_index` (default 0) and dropping NOT NULL on `lesson_id`, `module_id`, `date`, `period`. Accept. Completes without error.

- [ ] **Step 3: Write the backfill script**

Create `scripts/backfill-order-index.ts`:

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = drizzle(neon(url));

// Give each class's existing rows a contiguous order_index based on their
// current chronological placement. Overflow rows (null date) sort last.
await db.execute(sql`
	UPDATE scheduled_lesson s
	SET order_index = sub.rn - 1
	FROM (
		SELECT id, ROW_NUMBER() OVER (
			PARTITION BY user_id, class_id
			ORDER BY date ASC NULLS LAST, period ASC NULLS LAST
		) AS rn
		FROM scheduled_lesson
	) sub
	WHERE s.id = sub.id;
`);
console.log('Backfilled scheduled_lesson.order_index');
```

- [ ] **Step 4: Run the backfill**

Run: `bun run scripts/backfill-order-index.ts`
Expected: prints `Backfilled scheduled_lesson.order_index` and exits 0. (Bun auto-loads `.env` for `DATABASE_URL`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts scripts/backfill-order-index.ts
git commit -m "feat(db): make scheduled_lesson an ordered sequence (orderIndex, nullable slot/lesson)"
```

---

### Task 2: Pure allocation function `allocateSequence` (TDD)

The single source of allocation logic: given the class's ordered items and the future slot stream, decide which item lands in which slot and which overflow. Frozen (already-taught) items are excluded from output and left untouched.

**Files:**
- Create: `src/lib/scheduling/allocate.ts`
- Test: `src/lib/scheduling/allocate.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scheduling/allocate.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allocateSequence } from './allocate';
import type { PeriodOccurrence } from './types';

const stream: PeriodOccurrence[] = [
	{ date: '2026-09-14', period: 1, room: 'S1' },
	{ date: '2026-09-15', period: 2, room: 'S1' },
	{ date: '2026-09-16', period: 3, room: 'S2' }
];
const today = '2026-09-14';

describe('allocateSequence', () => {
	it('fills flow items chronologically onto the stream', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: null },
				{ id: 2, date: null }
			],
			stream,
			today
		);
		expect(out).toEqual([
			{ id: 1, date: '2026-09-14', period: 1, room: 'S1' },
			{ id: 2, date: '2026-09-15', period: 2, room: 'S1' }
		]);
	});

	it('excludes frozen past items from the output (leaves them untouched)', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: '2026-09-01' }, // frozen (before today)
				{ id: 2, date: null }
			],
			stream,
			today
		);
		expect(out.map((a) => a.id)).toEqual([2]);
		expect(out[0]).toEqual({ id: 2, date: '2026-09-14', period: 1, room: 'S1' });
	});

	it('overflows items beyond the stream to null date/period', () => {
		const out = allocateSequence(
			[
				{ id: 1, date: null },
				{ id: 2, date: null },
				{ id: 3, date: null },
				{ id: 4, date: null }
			],
			stream,
			today
		);
		expect(out[3]).toEqual({ id: 4, date: null, period: null, room: '' });
	});

	it('self-heals: a previously-overflowed item is allocated when the stream grows', () => {
		const items = [
			{ id: 1, date: null },
			{ id: 2, date: null },
			{ id: 3, date: null },
			{ id: 4, date: null }
		];
		const longer = [...stream, { date: '2026-09-17', period: 1, room: 'S1' }];
		const out = allocateSequence(items, longer, today);
		expect(out[3]).toEqual({ id: 4, date: '2026-09-17', period: 1, room: 'S1' });
	});

	it('reallocates a future (non-frozen) dated item rather than freezing it', () => {
		// date >= today is still "flow" and gets re-derived.
		const out = allocateSequence([{ id: 1, date: '2026-09-30' }], stream, today);
		expect(out[0]).toEqual({ id: 1, date: '2026-09-14', period: 1, room: 'S1' });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/allocate.spec.ts`
Expected: FAIL — `allocate.ts` does not exist / `allocateSequence is not a function`.

- [ ] **Step 3: Implement `allocateSequence`**

Create `src/lib/scheduling/allocate.ts`:

```ts
import type { IsoDate } from './dates';
import type { PeriodOccurrence } from './types';

/** A class's sequence row, as far as allocation cares: identity + current date. */
export interface SeqItem {
	id: number;
	date: IsoDate | null;
}

/** New slot assignment for a flow row. date/period null => overflow. */
export interface SlotAllocation {
	id: number;
	date: IsoDate | null;
	period: number | null;
	room: string;
}

/**
 * Map the class's ordered sequence onto its future slot stream.
 *
 * - Frozen rows (a non-null date strictly before `today`) are already taught;
 *   they are excluded from the result and must be left untouched by the caller.
 * - Remaining ("flow") rows, in sequence order, take the next available slot.
 * - Flow rows past the end of the stream overflow to null date/period.
 *
 * `futureStream` MUST already be filtered to slots on/after `today` and sorted
 * chronologically.
 */
export function allocateSequence(
	items: SeqItem[],
	futureStream: PeriodOccurrence[],
	today: IsoDate
): SlotAllocation[] {
	const flow = items.filter((it) => it.date === null || it.date >= today);
	return flow.map((it, i) => {
		const slot = futureStream[i];
		return slot
			? { id: it.id, date: slot.date, period: slot.period, room: slot.room }
			: { id: it.id, date: null, period: null, room: '' };
	});
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/allocate.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/allocate.ts src/lib/scheduling/allocate.spec.ts
git commit -m "feat(scheduling): add pure allocateSequence (sequence -> slots, overflow)"
```

---

### Task 3: `reallocateClass` and `reallocateAllClasses` DB wrappers

Thin DB wrappers around `allocateSequence`. This is the only place that writes `date`/`period`/`room` derived from the sequence.

**Files:**
- Modify: `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Replace the imports at the top of `schedule.ts`**

Replace lines 1-10 with:

```ts
import { eq, and, sql, lt, gte, or, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { getConfig, getBlocks, getClosures, getSlots } from './timetable';
import { getModule, listLessons } from './courses';
import { getClass } from './classes';
import { classPeriodStream } from '$lib/scheduling/periods';
import { allocateSequence } from '$lib/scheduling/allocate';
import type { SlotData } from '$lib/scheduling/types';
```

(`planModuleAssignment` and `addDays` are no longer used here.)

- [ ] **Step 2: Add `reallocateClass` and `reallocateAllClasses`**

Add after the `todayIso` function (after line 14):

```ts
/**
 * Re-derive date/period/room for a class's sequence from its future slot stream.
 * Frozen (already-taught) rows are left untouched. The single source of allocation.
 */
export async function reallocateClass(
	userId: string,
	classId: number,
	today: string = todayIso()
): Promise<void> {
	const [config, blocks, closures, slots, items] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId),
		getSlots(userId),
		db
			.select({ id: scheduledLesson.id, date: scheduledLesson.date })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)))
			.orderBy(scheduledLesson.orderIndex)
	]);

	const stream = classPeriodStream(
		config,
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		slots as SlotData[],
		classId
	).filter((o) => o.date >= today);

	const allocations = allocateSequence(items, stream, today);
	if (allocations.length === 0) return;

	await db.transaction(async (tx) => {
		for (const a of allocations) {
			await tx
				.update(scheduledLesson)
				.set({ date: a.date, period: a.period, room: a.room })
				.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, a.id)));
		}
	});
}

/** Reallocate every class for a user (used after timetable-wide changes). */
export async function reallocateAllClasses(
	userId: string,
	today: string = todayIso()
): Promise<void> {
	const classes = await db
		.select({ id: klass.id })
		.from(klass)
		.where(eq(klass.userId, userId));
	for (const c of classes) await reallocateClass(userId, c.id, today);
}
```

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: No errors introduced in `schedule.ts`. (There will be remaining references to the old `assignModule`/`unscheduleModule` bodies — those are rewritten in Task 4; if `check` flags unused imports there, continue to Task 4 before re-running.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/queries/schedule.ts
git commit -m "feat(schedule): add reallocateClass/reallocateAllClasses wrappers"
```

---

### Task 4: Rewrite `assignModule` and `unscheduleModule` to the sequence model

Assigning a module appends its lessons to the class sequence then reallocates. Unscheduling removes them then reallocates.

**Files:**
- Modify: `src/lib/server/queries/schedule.ts:23-97` (the old `assignModule`/`unscheduleModule`)

- [ ] **Step 1: Replace `assignModule`**

Replace the entire existing `assignModule` function with:

```ts
export async function assignModule(
	userId: string,
	moduleId: number,
	classId: number,
	today: string = todayIso()
): Promise<AssignResult> {
	const mod = await getModule(userId, moduleId);
	const cls = await getClass(userId, classId);
	if (!mod || !cls) throw new Error('Module or class not found');
	if (mod.courseId !== cls.courseId) throw new Error('Class does not study this course');

	const lessons = await listLessons(userId, moduleId);
	if (lessons.length === 0)
		return { scheduled: 0, unscheduled: 0, firstDate: null, lastDate: null };

	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${scheduledLesson.orderIndex}) + 1, 0)` })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)));

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

	await reallocateClass(userId, classId, today);

	const placed = await db
		.select({ date: scheduledLesson.date })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				eq(scheduledLesson.moduleId, moduleId)
			)
		)
		.orderBy(scheduledLesson.orderIndex);
	const dated = placed.map((p) => p.date).filter((d): d is string => d !== null);
	return {
		scheduled: dated.length,
		unscheduled: placed.length - dated.length,
		firstDate: dated[0] ?? null,
		lastDate: dated.at(-1) ?? null
	};
}
```

(The `AssignResult` interface above `assignModule` is unchanged and stays.)

- [ ] **Step 2: Replace `unscheduleModule`**

Replace the existing `unscheduleModule` with:

```ts
export async function unscheduleModule(
	userId: string,
	moduleId: number,
	classId: number,
	today: string = todayIso()
): Promise<void> {
	await db
		.delete(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.moduleId, moduleId),
				eq(scheduledLesson.classId, classId)
			)
		);
	await reallocateClass(userId, classId, today);
}
```

- [ ] **Step 3: Verify**

Run: `bun run check`
Expected: No type errors. (`planModuleAssignment` in `scheduler.ts` is now unused by app code but its file + spec remain valid; leaving it is acceptable, removing it is out of scope.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/queries/schedule.ts
git commit -m "feat(schedule): assign/unschedule module via sequence + reallocate"
```

---

### Task 5: Sequence-edit query helpers

Reorder, insert-blank, delete, rename, and a list query for the class page. Each mutating op (except rename) ends by reallocating.

**Files:**
- Modify: `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Add the helpers**

Append to `schedule.ts` (after `listUpcoming`):

```ts
/** The class's editable sequence: overflow rows + rows on/after today, in order. */
export function listClassSequence(userId: string, classId: number, today: string = todayIso()) {
	return db
		.select({
			id: scheduledLesson.id,
			orderIndex: scheduledLesson.orderIndex,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			room: scheduledLesson.room,
			title: scheduledLesson.title
		})
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				or(isNull(scheduledLesson.date), gte(scheduledLesson.date, today))
			)
		)
		.orderBy(scheduledLesson.orderIndex);
}

/** Renumber the visible (flow) rows after the frozen past prefix, in given order. */
export async function reorderSequence(
	userId: string,
	classId: number,
	orderedIds: number[],
	today: string = todayIso()
): Promise<void> {
	const [{ base }] = await db
		.select({ base: sql<number>`coalesce(max(${scheduledLesson.orderIndex}), -1)` })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.classId, classId),
				lt(scheduledLesson.date, today) // frozen past only (null dates excluded)
			)
		);
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(scheduledLesson)
				.set({ orderIndex: base + 1 + i })
				.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, orderedIds[i])));
		}
	});
	await reallocateClass(userId, classId, today);
}

/** Insert a blank spacer; rows at/after atOrderIndex shift forward by one. */
export async function insertBlank(
	userId: string,
	classId: number,
	atOrderIndex: number,
	title: string,
	today: string = todayIso()
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.update(scheduledLesson)
			.set({ orderIndex: sql`${scheduledLesson.orderIndex} + 1` })
			.where(
				and(
					eq(scheduledLesson.userId, userId),
					eq(scheduledLesson.classId, classId),
					gte(scheduledLesson.orderIndex, atOrderIndex)
				)
			);
		await tx.insert(scheduledLesson).values({
			userId,
			classId,
			lessonId: null,
			moduleId: null,
			title,
			orderIndex: atOrderIndex,
			date: null,
			period: null,
			room: ''
		});
	});
	await reallocateClass(userId, classId, today);
}

/** The orderIndex to append a new blank at the end of the class's sequence. */
export async function nextOrderIndex(userId: string, classId: number): Promise<number> {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${scheduledLesson.orderIndex}) + 1, 0)` })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)));
	return next;
}

/** Look up a row's orderIndex (for inserting a blank above it). */
export async function getOrderIndex(userId: string, id: number): Promise<number | null> {
	const [row] = await db
		.select({ orderIndex: scheduledLesson.orderIndex })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	return row?.orderIndex ?? null;
}

/** Delete one row from the sequence; the tail pulls back on reallocate. */
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
	await db
		.delete(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
	await reallocateClass(userId, row.classId, today);
}

/** Rename a single scheduled instance (does not touch the lesson template). */
export async function renameScheduledLesson(userId: string, id: number, title: string) {
	return db
		.update(scheduledLesson)
		.set({ title })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/queries/schedule.ts
git commit -m "feat(schedule): sequence edit helpers (list/reorder/insert/delete/rename)"
```

---

### Task 6: Wire reallocation into timetable + settings edits; reconcile Agenda delete

Timetable changes must re-derive allocations so the class page and Agenda stay correct. Agenda's per-lesson delete now reflows the tail.

**Files:**
- Modify: `src/routes/(app)/settings/+page.server.ts`
- Modify: `src/routes/(app)/timetable/+page.server.ts`
- Modify: `src/routes/(app)/agenda/+page.server.ts`

- [ ] **Step 1: settings — reallocate all classes after timetable-wide edits**

In `src/routes/(app)/settings/+page.server.ts`, add to the imports:

```ts
import { reallocateAllClasses } from '$lib/server/queries/schedule';
```

Then add `await reallocateAllClasses(userId);` as the last line of each of these action bodies: `saveConfig`, `addBlock`, `deleteBlock`, `addClosure`, `deleteClosure`. For example `saveConfig` becomes:

```ts
	saveConfig: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const teachingDays = form
			.getAll('teachingDays')
			.map((d) => Number(d))
			.filter((n) => n >= 1 && n <= 5);
		await upsertConfig(userId, {
			cycleWeeks: Number(form.get('cycleWeeks')),
			teachingDays,
			periodsPerDay: Number(form.get('periodsPerDay')),
			anchorLetter: String(form.get('anchorLetter'))
		});
		await reallocateAllClasses(userId);
	},
```

Apply the same trailing `await reallocateAllClasses(userId);` to `addBlock`, `deleteBlock`, `addClosure`, and `deleteClosure`.

- [ ] **Step 2: timetable — reallocate after slot edits**

In `src/routes/(app)/timetable/+page.server.ts`, add to the imports:

```ts
import { reallocateAllClasses } from '$lib/server/queries/schedule';
```

Add `await reallocateAllClasses(userId);` as the final line of the `set` action (covers both the `clearSlot` early-return path and the `setSlot` path — so restructure to a single exit):

```ts
	set: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const classId = Number(form.get('classId'));
		const weekLetter = String(form.get('weekLetter'));
		const dayOfWeek = Number(form.get('dayOfWeek'));
		const period = Number(form.get('period'));
		if (!classId) {
			await clearSlot(userId, weekLetter, dayOfWeek, period);
		} else {
			await setSlot(userId, {
				weekLetter,
				dayOfWeek,
				period,
				classId,
				room: String(form.get('room') ?? '')
			});
		}
		await reallocateAllClasses(userId);
	}
```

- [ ] **Step 3: agenda — route delete through the sequence helper**

In `src/routes/(app)/agenda/+page.server.ts`, change the import on line 7 from:

```ts
import { todayIso, deleteScheduledLesson, moveScheduledLesson } from '$lib/server/queries/schedule';
```

to:

```ts
import { todayIso, deleteFromSequence, moveScheduledLesson } from '$lib/server/queries/schedule';
```

And change the `deleteLesson` action body to:

```ts
	deleteLesson: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFromSequence(userId, Number(form.get('id')));
	},
```

(Leave `moveLesson` unchanged — it remains a deliberate one-off manual override per the spec.)

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/settings/+page.server.ts src/routes/\(app\)/timetable/+page.server.ts src/routes/\(app\)/agenda/+page.server.ts
git commit -m "feat: reallocate on timetable edits; reflow Agenda delete"
```

---

### Task 7: Link class names; add a `getClassWithCourse` query

Class names become links to `/classes/{id}` from Agenda, Calendar, and Classes. Add a query that returns a class joined with its course (for the new page header).

**Files:**
- Modify: `src/lib/server/queries/classes.ts`
- Modify: `src/routes/(app)/agenda/+page.server.ts` (add `classId` to select)
- Modify: `src/routes/(app)/agenda/+page.svelte` (link class name)
- Modify: `src/routes/(app)/calendar/+page.server.ts` (add `classId` to select)
- Modify: `src/routes/(app)/calendar/+page.svelte` (link class name)
- Modify: `src/routes/(app)/classes/+page.svelte` (link class name)

- [ ] **Step 1: Add `getClassWithCourse`**

Append to `src/lib/server/queries/classes.ts`:

```ts
export async function getClassWithCourse(userId: string, id: number) {
	const [row] = await db
		.select({
			id: klass.id,
			name: klass.name,
			courseId: klass.courseId,
			courseName: course.name,
			colour: course.colour
		})
		.from(klass)
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
	return row ?? null;
}
```

- [ ] **Step 2: Agenda load — include `classId`**

In `src/routes/(app)/agenda/+page.server.ts`, add `classId: scheduledLesson.classId,` to the `.select({...})` object (e.g. right after the `id:` line).

- [ ] **Step 3: Agenda template — link the class name**

In `src/routes/(app)/agenda/+page.svelte`, replace:

```svelte
				<span class="w-16 font-bold">{item.className}</span>
```

with:

```svelte
				<a
					href="/classes/{item.classId}"
					class="w-16 font-bold text-pink-dk hover:underline">{item.className}</a
				>
```

- [ ] **Step 4: Calendar load — include `classId`**

In `src/routes/(app)/calendar/+page.server.ts`, add `classId: scheduledLesson.classId,` to the `.select({...})` object.

- [ ] **Step 5: Calendar template — link the class name**

In `src/routes/(app)/calendar/+page.svelte`, replace:

```svelte
									<div class="text-xs font-bold">{l.className}</div>
```

with:

```svelte
									<a
										href="/classes/{l.classId}"
										class="text-xs font-bold hover:underline">{l.className}</a
									>
```

- [ ] **Step 6: Classes template — link the class name**

In `src/routes/(app)/classes/+page.svelte`, replace:

```svelte
				<span class="font-semibold text-ink">{c.name}</span>
```

with:

```svelte
				<a href="/classes/{c.id}" class="font-semibold text-ink hover:text-pink-dk hover:underline"
					>{c.name}</a
				>
```

- [ ] **Step 7: Verify**

Run: `bun run check`
Expected: No type errors (`item.classId` / `l.classId` now exist on the load data).

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/queries/classes.ts src/routes/\(app\)/agenda src/routes/\(app\)/calendar src/routes/\(app\)/classes/+page.svelte
git commit -m "feat: link class names to the class page; add getClassWithCourse"
```

---

### Task 8: Install `svelte-dnd-action`

**Files:**
- Modify: `package.json` (via package manager)

- [ ] **Step 1: Add the dependency**

Run: `bun add svelte-dnd-action`
Expected: adds `svelte-dnd-action` to `dependencies` (it ships its own TypeScript types and supports Svelte 5).

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add svelte-dnd-action"
```

---

### Task 9: Class page route — load + actions

**Files:**
- Create: `src/routes/(app)/classes/[classId]/+page.server.ts`

- [ ] **Step 1: Write the page server**

Create `src/routes/(app)/classes/[classId]/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getClassWithCourse } from '$lib/server/queries/classes';
import {
	todayIso,
	listClassSequence,
	reorderSequence,
	insertBlank,
	deleteFromSequence,
	renameScheduledLesson,
	nextOrderIndex,
	getOrderIndex
} from '$lib/server/queries/schedule';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const classId = Number(event.params.classId);
	const cls = await getClassWithCourse(userId, classId);
	if (!cls) throw error(404, 'Class not found');

	const today = todayIso();
	const rows = await listClassSequence(userId, classId, today);

	const [config, blocks, closures] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId)
	]);
	const teaching = listTeachingDays(
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		config.teachingDays
	);
	const weekMap = resolveWeekLetters(config.cycleWeeks, config.anchorLetter, teaching);

	const items = rows.map((r) => ({
		...r,
		weekLetter: r.date ? weekLetterForDate(r.date, weekMap) : null
	}));

	return { klass: cls, items };
};

export const actions: Actions = {
	reorder: async (event) => {
		const userId = requireUserId(event);
		const classId = Number(event.params.classId);
		const form = await event.request.formData();
		const orderedIds = String(form.get('orderedIds'))
			.split(',')
			.map(Number)
			.filter((n) => Number.isFinite(n));
		await reorderSequence(userId, classId, orderedIds);
	},
	insertBlank: async (event) => {
		const userId = requireUserId(event);
		const classId = Number(event.params.classId);
		const form = await event.request.formData();
		const beforeIdRaw = form.get('beforeId');
		const title = String(form.get('title') ?? 'New lesson').trim() || 'New lesson';
		const at =
			beforeIdRaw != null && String(beforeIdRaw) !== ''
				? await getOrderIndex(userId, Number(beforeIdRaw))
				: await nextOrderIndex(userId, classId);
		if (at === null) return;
		await insertBlank(userId, classId, at, title);
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFromSequence(userId, Number(form.get('id')));
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await renameScheduledLesson(userId, Number(form.get('id')), String(form.get('title')).trim());
	}
};
```

- [ ] **Step 2: Verify**

Run: `bun run check`
Expected: No type errors. (`./$types` resolves once the route file exists and `svelte-kit sync` runs as part of `check`.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/\(app\)/classes/\[classId\]/+page.server.ts
git commit -m "feat(classes): class page load + sequence-edit actions"
```

---

### Task 10: Class page UI with drag-and-drop

A single ordered list of flow items. Dated rows show date/period/week; overflow rows (null date) render greyed under a warning. Drag-and-drop via `svelte-dnd-action`; on drop, POST `orderedIds` to `?/reorder` and `invalidateAll()`. Up/down buttons provide an accessible fallback. Inline rename, delete, insert-blank-above, and add-blank-at-end.

**Files:**
- Create: `src/routes/(app)/classes/[classId]/+page.svelte`

- [ ] **Step 1: Write the component**

Create `src/routes/(app)/classes/[classId]/+page.svelte`:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { dndzone } from 'svelte-dnd-action';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SubjectDot from '$lib/components/SubjectDot.svelte';

	let { data } = $props<{ data: import('./$types').PageData }>();

	// Local, drag-mutable copy of the sequence. Re-synced whenever the load data changes.
	let items = $state(data.items);
	$effect(() => {
		items = data.items;
	});

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}

	async function persistOrder() {
		const body = new FormData();
		body.set('orderedIds', items.map((i) => i.id).join(','));
		await fetch('?/reorder', { method: 'POST', body });
		await invalidateAll();
	}

	function handleConsider(e: CustomEvent<{ items: typeof items }>) {
		items = e.detail.items;
	}
	function handleFinalize(e: CustomEvent<{ items: typeof items }>) {
		items = e.detail.items;
		persistOrder();
	}

	function moved(index: number, dir: -1 | 1): string {
		const ids = items.map((i) => i.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}

	const firstOverflowId = $derived(items.find((i) => i.date === null)?.id ?? null);
</script>

<a href="/classes" class="text-sm font-medium text-pink-dk hover:underline">← Classes</a>
<PageHeader title={data.klass.name} subtitle={data.klass.courseName} />

{#if items.length === 0}
	<EmptyState message="No lessons scheduled for this class yet. Assign a module from its course." />
{:else}
	<ul
		class="mb-4 flex flex-col gap-2"
		use:dndzone={{ items, flipDurationMs: 150 }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
	>
		{#each items as item, i (item.id)}
			{#if item.id === firstOverflowId}
				<li class="mt-2 px-1 text-xs font-semibold text-muted">
					No timetabled slot yet — these will be scheduled when space frees up.
				</li>
			{/if}
			<li
				class="group flex items-center gap-3 rounded-card border px-4 py-3 text-sm transition
				{item.date === null
					? 'border-dashed border-line bg-field/50 text-muted'
					: 'border-line bg-white hover:border-pink-200'}"
			>
				<span class="cursor-grab select-none px-1 text-muted" aria-hidden="true">⠿</span>

				<div class="flex flex-col gap-0.5">
					<form method="POST" action="?/reorder" use:enhance>
						<input type="hidden" name="orderedIds" value={moved(i, -1)} />
						<button
							class="px-1 text-muted hover:text-ink disabled:opacity-30"
							disabled={i === 0}
							aria-label="Move up">↑</button
						>
					</form>
					<form method="POST" action="?/reorder" use:enhance>
						<input type="hidden" name="orderedIds" value={moved(i, 1)} />
						<button
							class="px-1 text-muted hover:text-ink disabled:opacity-30"
							disabled={i === items.length - 1}
							aria-label="Move down">↓</button
						>
					</form>
				</div>

				{#if item.date}
					<span class="w-28 shrink-0 font-semibold text-ink/80">{label(item.date)}</span>
					<span class="w-7 shrink-0 font-bold text-muted">P{item.period}</span>
					{#if item.weekLetter}<span class="w-10 shrink-0 text-xs text-muted">Wk {item.weekLetter}</span
						>{/if}
				{:else}
					<span class="w-28 shrink-0 text-xs italic">unscheduled</span>
				{/if}

				<SubjectDot colour={data.klass.colour} shape="bar" />

				<form method="POST" action="?/rename" use:enhance class="flex flex-1 items-center gap-2">
					<input type="hidden" name="id" value={item.id} />
					<input
						name="title"
						value={item.title}
						class="flex-1 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-pink-200 focus:bg-white"
					/>
					<Button type="submit" variant="secondary" size="sm">Save</Button>
				</form>

				{#if item.room}<span
						class="rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-muted">{item.room}</span
					>{/if}

				<div class="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
					<form method="POST" action="?/insertBlank" use:enhance>
						<input type="hidden" name="beforeId" value={item.id} />
						<Button type="submit" variant="secondary" size="sm">+ Blank above</Button>
					</form>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="danger" size="sm">Delete</Button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<Card>
	<form method="POST" action="?/insertBlank" use:enhance class="flex items-end gap-3">
		<Button type="submit">Add blank lesson at end</Button>
	</form>
</Card>
```

- [ ] **Step 2: Run the Svelte autofixer (MANDATORY)**

Use the `svelte-autofixer` MCP tool on `src/routes/(app)/classes/[classId]/+page.svelte`. Apply its suggestions and re-run until it returns no issues. (Pay attention to: `$effect` resyncing `items`, event handler typing for `onconsider`/`onfinalize`, and any a11y warnings on the drag handle / interactive list.)

- [ ] **Step 3: Verify types and lint**

Run: `bun run check && bun run lint`
Expected: No errors. (If `lint` reports formatting, run `bun run format` and re-stage.)

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(app\)/classes/\[classId\]/+page.svelte
git commit -m "feat(classes): class page UI with drag-and-drop lesson sequence"
```

---

### Task 11: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the unit test suite**

Run: `bun run test:unit -- --run`
Expected: All tests pass, including `allocate.spec.ts` and the existing `scheduling/*` specs.

- [ ] **Step 2: Type-check and lint the whole project**

Run: `bun run check && bun run lint`
Expected: No errors.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `bun run dev`, then in the browser:
- From **Classes**, **Agenda**, and **Calendar**, click a class name → lands on `/classes/{id}`.
- Drag a lesson to reorder → dates re-derive after the list settles; refresh confirms persistence.
- Up/down arrows reorder identically.
- "+ Blank above" inserts a spacer and pushes the tail forward by one slot.
- Rename a lesson, Save → title persists; the module's lesson template (under Courses) is unchanged.
- Delete a lesson → tail pulls back one slot.
- If a class has more lessons than remaining slots, the surplus shows greyed under the "No timetabled slot yet" notice; deleting an earlier lesson flows one back in.

Expected: all behaviours as described; no console errors.

- [ ] **Step 4: Final commit (if any formatting/fixups)**

```bash
git add -A
git commit -m "chore: verification fixups for class page sequence"
```

---

## Self-Review Notes

- **Spec coverage:** routing/links (Task 7), schema + nullable + orderIndex (Task 1), `reallocateClass` single source (Task 3), sequence ops reorder/insert/delete/rename (Tasks 5, 9, 10), assign/unschedule via sequence (Task 4), timetable hooks (Task 6), Agenda delete reconcile (Task 6), overflow self-heal UI (Tasks 9, 10), past hidden (Task 5 `listClassSequence` filter), DnD via `svelte-dnd-action` with button fallback (Tasks 8, 10), tests for allocation (Task 2). All spec sections map to a task.
- **Deviation from spec:** the spec mentioned a unique `(userId, classId, orderIndex)` constraint; this plan omits it to match the existing `reorderLessons`/`reorderModules` pattern (sequential in-transaction renumbering would otherwise hit mid-transaction collisions). Uniqueness is guaranteed by the renumber logic instead.
- **Type consistency:** `allocateSequence(items, futureStream, today)` and `SlotAllocation`/`SeqItem` are used identically in Tasks 2 and 3. `listClassSequence` row shape (`id, orderIndex, date, period, room, title`) matches what Task 9 maps and Task 10 renders (`item.date`, `item.period`, `item.room`, `item.title`, `item.weekLetter`, `item.id`). Action names (`reorder`, `insertBlank`, `delete`, `rename`) match between Task 9 server and Task 10 forms.
