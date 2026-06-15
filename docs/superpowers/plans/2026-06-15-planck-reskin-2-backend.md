# Planck Reskin — Plan 2: Backend Additions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the schema columns, queries, actions and a scheduling helper that the reskinned screens (Plan 3) wire up: per-class colour, lesson/module notes, agenda done + postpone, closure names, and weekend teaching days.

**Architecture:** Additive, non-destructive schema changes (all columns have defaults) applied via the project's existing `db:push` workflow + one backfill statement. New query functions live beside existing ones in `src/lib/server/queries/*`; a pure `nextFreeSlots` core lives in `src/lib/scheduling/` (unit-tested) with a thin DB wrapper.

**Tech Stack:** Drizzle ORM (Postgres, `neon-http` — **no transactions**, use `db.batch()`), drizzle-kit `db:push`, vitest (node `server` project).

**DB notes (from project memory):**

- `db:push` never prints "No changes" and always shows a phantom `scheduled_lesson` unique-constraint diff — **do not** accept any truncate/data-loss prompt; proceed only with the additive `ADD COLUMN` statements.
- New columns have defaults, so adds are safe.

**Verification posture:** the repo has no DB integration-test harness, so query/action correctness is verified by `bun run check` (types) + targeted manual checks via `bun run db:studio` / dev. Pure logic (`nextFreeSlots`, teaching-days) is unit-tested.

---

## File structure

| File                                        | Responsibility                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts`               | + `class.colour`, `lesson.note`, `scheduled_lesson.note/done/postponed`, `module.description`, `closure_day.name`                     |
| `src/lib/server/queries/classes.ts`         | colour in create/update + select `klass.colour`; `courseColour` in `getClassWithCourse`                                               |
| `src/lib/server/queries/courses.ts`         | `updateModuleDescription`, `updateLessonNote`                                                                                         |
| `src/lib/server/queries/schedule.ts`        | `setScheduledLessonDone`, `updateScheduledLessonNote`, `postponeScheduledLesson`, `nextFreeSlots` (DB wrapper); copy `note` on assign |
| `src/lib/server/queries/timetable.ts`       | `addClosure(name, date)`                                                                                                              |
| `src/lib/scheduling/free-slots.ts`          | pure `pickFreeSlots(stream, occupied, n)`                                                                                             |
| `src/lib/scheduling/free-slots.spec.ts`     | tests                                                                                                                                 |
| `src/lib/scheduling/teaching-days.spec.ts`  | + weekend case                                                                                                                        |
| `src/routes/(app)/settings/+page.server.ts` | relax day filter to 1..7; pass closure name                                                                                           |
| `src/routes/(app)/agenda/+page.server.ts`   | select done/note/postponed; `toggleDone`, `postpone`, `nextSlots`                                                                     |

---

## Task 1: Schema columns + push + backfill

**Files:**

- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Add columns** to `schema.ts`:

In `course`/`klass`/`module`/`lesson`/`scheduledLesson`/`closureDay` add:

```ts
// klass
	colour: text('colour').notNull().default('#8775c6'),
// module
	description: text('description').notNull().default(''),
// lesson
	note: text('note').notNull().default(''),
// closureDay
	name: text('name').notNull().default(''),
// scheduledLesson
	note: text('note').notNull().default(''),
	done: boolean('done').notNull().default(false),
	postponed: boolean('postponed').notNull().default(false),
```

Add `boolean` to the drizzle import:

```ts
import { pgTable, serial, integer, text, date, unique, boolean } from 'drizzle-orm/pg-core';
```

- [ ] **Step 2: Push the schema**

Run: `bun run db:push`
Expected: drizzle shows ADD COLUMN statements for the six new columns (plus the known phantom `scheduled_lesson` unique-constraint diff). **Decline** any prompt that would truncate/drop data; accept only the additive column adds. Confirm completion without data loss.

- [ ] **Step 3: Backfill `class.colour` from each class's course**

Run (via studio SQL console or a one-off query — `bun run db:studio`, open the SQL tab):

```sql
UPDATE class SET colour = course.colour
FROM course
WHERE class.course_id = course.id;
```

Expected: existing classes now carry their course's colour (visual continuity).

- [ ] **Step 4: Verify types**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat(db): add class.colour, notes, agenda flags, closure name"
```

---

## Task 2: Class colour in queries

**Files:**

- Modify: `src/lib/server/queries/classes.ts`

- [ ] **Step 1: `listClasses`** — select `klass.colour` (not `course.colour`):

```ts
export function listClasses(userId: string) {
	return db
		.select({
			id: klass.id,
			name: klass.name,
			courseId: klass.courseId,
			courseName: course.name,
			colour: klass.colour
		})
		.from(klass)
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(eq(klass.userId, userId))
		.orderBy(klass.name);
}
```

- [ ] **Step 2: `createClass` / `updateClass`** accept colour:

```ts
export function createClass(userId: string, name: string, courseId: number, colour: string) {
	return db.insert(klass).values({ userId, name, courseId, colour });
}

export function updateClass(
	userId: string,
	id: number,
	name: string,
	courseId: number,
	colour: string
) {
	return db
		.update(klass)
		.set({ name, courseId, colour })
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
}
```

- [ ] **Step 3: `getClassWithCourse`** — class colour as `colour`, keep course colour as `courseColour`:

```ts
export async function getClassWithCourse(userId: string, id: number) {
	const [row] = await db
		.select({
			id: klass.id,
			name: klass.name,
			courseId: klass.courseId,
			courseName: course.name,
			colour: klass.colour,
			courseColour: course.colour
		})
		.from(klass)
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
	return row ?? null;
}
```

- [ ] **Step 4: Update callers' types** — `bun run check` will flag `createClass`/`updateClass` call sites in `classes/+page.server.ts`. Update those actions to read & pass `colour`:

```ts
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const name = String(form.get('name')).trim();
		const courseId = Number(form.get('courseId'));
		const colour = String(form.get('colour') || '#8775c6');
		if (!name || !courseId) throw error(400, 'Name and course required');
		await createClass(userId, name, courseId, colour);
	},
	update: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateClass(
			userId,
			Number(form.get('id')),
			String(form.get('name')),
			Number(form.get('courseId')),
			String(form.get('colour') || '#8775c6')
		);
	},
```

- [ ] **Step 5: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/queries/classes.ts "src/routes/(app)/classes/+page.server.ts"
git commit -m "feat(classes): per-class colour in queries + actions"
```

---

## Task 3: Module description + lesson note queries/actions

**Files:**

- Modify: `src/lib/server/queries/courses.ts`
- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.server.ts`

- [ ] **Step 1: Add queries** to `courses.ts`:

```ts
export function updateModuleDescription(userId: string, id: number, description: string) {
	return db
		.update(module)
		.set({ description })
		.where(and(eq(module.userId, userId), eq(module.id, id)));
}

export function updateLessonNote(userId: string, id: number, note: string) {
	return db
		.update(lesson)
		.set({ note })
		.where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
}
```

Also include `note` in `getLesson`'s select (add `note: lesson.note,`) and `description` in `getModule` (it uses `select()` so it already returns all columns — no change needed).

- [ ] **Step 2: Add module-detail actions** in the module `+page.server.ts` (import the two new queries):

```ts
	saveDescription: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateModuleDescription(userId, Number(event.params.moduleId), String(form.get('description')));
	},
	saveLessonNote: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateLessonNote(userId, Number(form.get('id')), String(form.get('note')));
	},
```

- [ ] **Step 3: Add per-lesson attachment counts to the module load** (Spec §5 "count only"). In the module `+page.server.ts` load, after `listLessons`, fetch grouped counts and merge:

```ts
import { lessonAttachmentCounts } from '$lib/server/queries/resources';
// ...
const lessons = await listLessons(userId, moduleId);
const counts = await lessonAttachmentCounts(
	userId,
	lessons.map((l) => l.id)
);
return {
	module: mod,
	lessons: lessons.map((l) => ({ ...l, attachmentCount: counts[l.id] ?? 0 }))
	// ...rest unchanged
};
```

- [ ] **Step 4: Implement `lessonAttachmentCounts`** in `src/lib/server/queries/resources.ts` (grouped count of links+files per lessonId):

```ts
import { inArray, sql } from 'drizzle-orm';
// ...
export async function lessonAttachmentCounts(
	userId: string,
	lessonIds: number[]
): Promise<Record<number, number>> {
	if (lessonIds.length === 0) return {};
	const links = await db
		.select({ id: resourceLink.lessonId, n: sql<number>`count(*)` })
		.from(resourceLink)
		.where(and(eq(resourceLink.userId, userId), inArray(resourceLink.lessonId, lessonIds)))
		.groupBy(resourceLink.lessonId);
	const files = await db
		.select({ id: resourceFile.lessonId, n: sql<number>`count(*)` })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), inArray(resourceFile.lessonId, lessonIds)))
		.groupBy(resourceFile.lessonId);
	const out: Record<number, number> = {};
	for (const r of [...links, ...files])
		if (r.id != null) out[r.id] = (out[r.id] ?? 0) + Number(r.n);
	return out;
}
```

(Check the existing imports/exports in `resources.ts`; reuse its `db`, `resourceLink`, `resourceFile`, `and`, `eq`.)

- [ ] **Step 5: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/queries/courses.ts src/lib/server/queries/resources.ts "src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.server.ts"
git commit -m "feat(modules): description + lesson note + attachment counts"
```

---

## Task 4: Pure free-slot picker (TDD)

**Files:**

- Create: `src/lib/scheduling/free-slots.ts`
- Test: `src/lib/scheduling/free-slots.spec.ts`

- [ ] **Step 1: Failing test** — `free-slots.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickFreeSlots } from './free-slots';

const stream = [
	{ date: '2026-06-16', period: 2, room: 'R1' },
	{ date: '2026-06-17', period: 1, room: 'R2' },
	{ date: '2026-06-18', period: 5, room: 'R3' },
	{ date: '2026-06-22', period: 1, room: 'R4' }
];

describe('pickFreeSlots', () => {
	it('returns the first n slots not in occupied', () => {
		const occupied = new Set(['2026-06-16|2']);
		expect(pickFreeSlots(stream, occupied, 2)).toEqual([
			{ date: '2026-06-17', period: 1, room: 'R2' },
			{ date: '2026-06-18', period: 5, room: 'R3' }
		]);
	});
	it('returns fewer than n when the stream is short', () => {
		expect(pickFreeSlots(stream, new Set(), 10)).toHaveLength(4);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/scheduling/free-slots.spec.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `free-slots.ts`:**

```ts
import type { IsoDate } from './dates';

export interface SlotOccurrence {
	date: IsoDate;
	period: number;
	room: string;
}

/** First `n` stream slots whose `${date}|${period}` key is not in `occupied`. */
export function pickFreeSlots(
	stream: SlotOccurrence[],
	occupied: Set<string>,
	n: number
): SlotOccurrence[] {
	const out: SlotOccurrence[] = [];
	for (const s of stream) {
		if (occupied.has(`${s.date}|${s.period}`)) continue;
		out.push(s);
		if (out.length >= n) break;
	}
	return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/scheduling/free-slots.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/free-slots.ts src/lib/scheduling/free-slots.spec.ts
git commit -m "feat(scheduling): pure pickFreeSlots helper"
```

---

## Task 5: Agenda done / note / postpone queries

**Files:**

- Modify: `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Add queries** to `schedule.ts`:

```ts
export function setScheduledLessonDone(userId: string, id: number, done: boolean) {
	return db
		.update(scheduledLesson)
		.set({ done })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

export function updateScheduledLessonNote(userId: string, id: number, note: string) {
	return db
		.update(scheduledLesson)
		.set({ note })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

/** Manual move to a chosen free slot; flags the row postponed. Like moveScheduledLesson
 *  but sets postponed=true. Not reflowed (a later reallocate may overwrite — accepted). */
export function postponeScheduledLesson(
	userId: string,
	id: number,
	date: string,
	period: number,
	room: string
) {
	return db
		.update(scheduledLesson)
		.set({ date, period, room, postponed: true })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}
```

- [ ] **Step 2: DB wrapper `nextFreeSlots`** — build the class's future stream + occupancy and delegate to `pickFreeSlots`:

```ts
import { pickFreeSlots, type SlotOccurrence } from '$lib/scheduling/free-slots';
// ...
export async function nextFreeSlots(
	userId: string,
	scheduledLessonId: number,
	n = 4,
	today: string = todayIso()
): Promise<SlotOccurrence[]> {
	const [row] = await db
		.select({
			classId: scheduledLesson.classId,
			date: scheduledLesson.date,
			period: scheduledLesson.period
		})
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, scheduledLessonId)));
	if (!row) return [];

	const inputs = await loadTimetableInputs(userId);
	const stream = classPeriodStream(
		inputs.config,
		inputs.blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		inputs.closures.map((c) => c.date),
		inputs.slots as SlotData[],
		row.classId
	).filter((o) => o.date >= today);

	const taken = await db
		.select({ date: scheduledLesson.date, period: scheduledLesson.period })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, row.classId)));
	const occupied = new Set(
		taken.filter((t) => t.date !== null && t.period !== null).map((t) => `${t.date}|${t.period}`)
	);
	// allow the lesson's own current slot to be excluded too (it's "taken" by itself)
	return pickFreeSlots(stream, occupied, n);
}
```

(`loadTimetableInputs`, `classPeriodStream`, `SlotData` are already imported/defined in this file.)

- [ ] **Step 3: Copy `note` on assign** — in `copyLessonContent` (or `assignModule`'s insert), carry the template lesson's note. Simplest: in `assignModule`, change the insert `title: l.title` block to also set `note: l.note` (and select `note` in `listLessons` — it uses `select()` so note is already returned). Add `note: l.note` to the `.values({...})`.

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/queries/schedule.ts
git commit -m "feat(schedule): done/note/postpone queries + nextFreeSlots"
```

---

## Task 6: Agenda load + actions

**Files:**

- Modify: `src/routes/(app)/agenda/+page.server.ts`

- [ ] **Step 1: Add `done`, `note`, `postponed`, `courseId` to the load select** (so cards can render them and link to the course/subject):

```ts
		.select({
			id: scheduledLesson.id,
			classId: scheduledLesson.classId,
			courseId: klass.courseId,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			note: scheduledLesson.note,
			room: scheduledLesson.room,
			done: scheduledLesson.done,
			postponed: scheduledLesson.postponed,
			className: klass.name,
			courseName: course.name,
			colour: course.colour
		})
```

- [ ] **Step 2: Current-term eyebrow + precomputed postpone candidates.** After loading `blocks`, find the block containing today; and attach each dated item's next free slots so the postpone dropdown needs no extra round-trip:

```ts
const term = blocks.find((b) => b.startDate <= today && today <= b.endDate)?.name ?? null;
// after groups are built (each item has an id):
const groupsWithSlots = await Promise.all(
	groups.map(async (g) => ({
		...g,
		items: await Promise.all(
			g.items.map(async (it) => ({
				...it,
				postponeSlots: await nextFreeSlots(userId, it.id, 4)
			}))
		)
	}))
);
return { groups: groupsWithSlots, term };
```

(Import `nextFreeSlots`. Agenda upcoming lists are small, so per-item computation is fine.)

- [ ] **Step 3: Add actions** `toggleDone` and `postpone`. Import `setScheduledLessonDone`, `postponeScheduledLesson`, `nextFreeSlots`:

```ts
	toggleDone: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await setScheduledLessonDone(userId, Number(form.get('id')), form.get('done') === 'true');
	},
	postpone: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const date = String(form.get('date'));
		const period = Number(form.get('period'));
		const room = String(form.get('room') ?? '');
		// trust only server-computed candidates: re-validate it's a free timetabled slot
		const candidates = await nextFreeSlots(userId, id, 50);
		if (!candidates.some((c) => c.date === date && c.period === period))
			return fail(400, { moveError: 'That slot is no longer available' });
		await postponeScheduledLesson(userId, id, date, period, room);
	},
```

(Keep the existing `moveLesson` and `deleteLesson` actions.)

- [ ] **Step 4: Verify**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/agenda/+page.server.ts"
git commit -m "feat(agenda): done/postpone/nextSlots actions + term eyebrow"
```

---

## Task 7: Settings — weekend days + closure names

**Files:**

- Modify: `src/lib/server/queries/timetable.ts`
- Modify: `src/routes/(app)/settings/+page.server.ts`
- Test: `src/lib/scheduling/teaching-days.spec.ts`

- [ ] **Step 1: Failing weekend test** — append to `teaching-days.spec.ts`:

```ts
it('includes weekend days when configured', () => {
	const days = listTeachingDays(
		[{ startDate: '2026-09-14', endDate: '2026-09-20' }], // Mon..Sun
		[],
		[6, 7] // Sat, Sun
	);
	expect(days).toEqual(['2026-09-19', '2026-09-20']);
});
```

- [ ] **Step 2: Run to verify it fails or passes**

Run: `bunx vitest run src/lib/scheduling/teaching-days.spec.ts`
Expected: PASS already (the lib's `DayOfWeek` is `1..7` and `listTeachingDays` is day-agnostic). If it passes, the core needs no change — the only constraint is the settings filter (next step). Keep the test as a regression guard.

- [ ] **Step 3: Relax the settings day filter** — in `settings/+page.server.ts` `saveConfig`, change the filter from `n >= 1 && n <= 5` to `n >= 1 && n <= 7`:

```ts
const teachingDays = form
	.getAll('teachingDays')
	.map((d) => Number(d))
	.filter((n) => n >= 1 && n <= 7);
```

- [ ] **Step 4: Closure name** — update `addClosure` in `timetable.ts`:

```ts
export function addClosure(userId: string, name: string, date: string) {
	return db.insert(closureDay).values({ userId, name, date });
}
```

And the settings `addClosure` action to pass the name:

```ts
	addClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addClosure(userId, String(form.get('name') ?? ''), String(form.get('date')));
		await reallocateAllClasses(userId);
	},
```

- [ ] **Step 5: Verify**

Run: `bun run check && bunx vitest run --project server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduling/teaching-days.spec.ts src/lib/server/queries/timetable.ts "src/routes/(app)/settings/+page.server.ts"
git commit -m "feat(settings): weekend teaching days + named closures (backend)"
```

---

## Task 8: Plan-2 verification sweep

- [ ] **Step 1:** `bun run check && bun run lint` → PASS (run `bun run format` if needed).
- [ ] **Step 2:** `bunx vitest run --project server` → PASS (colour, meta, free-slots, teaching-days, existing scheduling specs).
- [ ] **Step 3:** Manual: `bun run db:studio`, confirm the new columns exist and `class.colour` is backfilled; spot-check one class row.

---

## Self-review notes

- Spec §4 schema table → Task 1 (all 7 columns). ✓
- class colour queries/actions → Task 2. ✓
- module description + lesson note + attachment counts → Task 3. ✓
- nextFreeSlots (pure + wrapper) → Tasks 4-5. ✓
- agenda done/postpone/term → Tasks 5-6. ✓
- weekend days + closure names → Task 7. ✓
- Account card is **client-only** (better-auth) → no backend task; implemented in Plan 3.
- Type consistency: `nextFreeSlots`/`pickFreeSlots` return `SlotOccurrence {date,period,room}`; agenda `postpone` consumes `{date,period,room}`. `getClassWithCourse` returns `colour` (class) + `courseColour`. `listClasses` returns `colour` (class).
