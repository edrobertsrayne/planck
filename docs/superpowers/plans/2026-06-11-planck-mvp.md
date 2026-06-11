# planck MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the planck MVP — a per-teacher lesson planner where you configure term dates and a two-week ordinal-period timetable, build Course → Module → Lesson content, assign a module to a class to auto-schedule its lessons into upcoming periods, and view everything as an agenda or calendar.

**Architecture:** All date/cycle/scheduling logic lives in pure, DB-free functions under `src/lib/scheduling/` (unit-tested in isolation). Persistence is Drizzle/Postgres tables scoped per better-auth user, accessed through query modules in `src/lib/server/queries/`. SvelteKit form actions load the teacher from the session, call a pure function where logic is involved, and persist. Authenticated screens live under a `(app)` route group with a shared nav layout.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Drizzle ORM on Postgres (neon-http), better-auth (email/password), Tailwind v4, vitest (unit), Playwright (e2e). Package manager: **bun**.

**Conventions for every task:**
- Run unit tests with `bun run test:unit -- --run <path>`; type-check with `bun run check`.
- Dates are represented everywhere as `'YYYY-MM-DD'` strings (`IsoDate`) and compared lexicographically. All date math is done in UTC to avoid DST drift.
- Every Svelte component written during implementation MUST be passed through the Svelte MCP `svelte-autofixer` tool until it reports no issues (project rule in CLAUDE.md).
- Commit after every task with the message shown in its final step.

---

## Phase 0 — Database schema

### Task 1: Generate auth tables and define the domain schema

**Files:**
- Generate: `src/lib/server/db/auth.schema.ts` (via CLI)
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: Generate the better-auth Drizzle tables**

Run: `bun run auth:schema`
Expected: `src/lib/server/db/auth.schema.ts` is overwritten with real exports including `user`, `session`, `account`, `verification`. Confirm `user` is exported and its `id` column is `text`.

- [ ] **Step 2: Replace the placeholder domain schema**

Replace the entire contents of `src/lib/server/db/schema.ts` with:

```ts
import {
	pgTable,
	serial,
	integer,
	text,
	date,
	unique
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// One row per teacher.
export const timetableConfig = pgTable('timetable_config', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	cycleWeeks: integer('cycle_weeks').notNull().default(2),
	teachingDays: integer('teaching_days').array().notNull().default([1, 2, 3, 4, 5]),
	periodsPerDay: integer('periods_per_day').notNull().default(5),
	anchorLetter: text('anchor_letter').notNull().default('A')
});

export const teachingBlock = pgTable('teaching_block', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	startDate: date('start_date', { mode: 'string' }).notNull(),
	endDate: date('end_date', { mode: 'string' }).notNull()
});

export const closureDay = pgTable('closure_day', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	date: date('date', { mode: 'string' }).notNull()
});

export const course = pgTable('course', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	colour: text('colour').notNull().default('#3884ff')
});

export const module = pgTable('module', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});

export const lesson = pgTable('lesson', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	moduleId: integer('module_id')
		.notNull()
		.references(() => module.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	orderIndex: integer('order_index').notNull().default(0)
});

export const klass = pgTable('class', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	courseId: integer('course_id')
		.notNull()
		.references(() => course.id, { onDelete: 'cascade' })
});

export const timetableSlot = pgTable(
	'timetable_slot',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		weekLetter: text('week_letter').notNull(),
		dayOfWeek: integer('day_of_week').notNull(),
		period: integer('period').notNull(),
		classId: integer('class_id')
			.notNull()
			.references(() => klass.id, { onDelete: 'cascade' }),
		room: text('room').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.weekLetter, t.dayOfWeek, t.period)]
);

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
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		moduleId: integer('module_id')
			.notNull()
			.references(() => module.id, { onDelete: 'cascade' }),
		date: date('date', { mode: 'string' }).notNull(),
		period: integer('period').notNull(),
		title: text('title').notNull(),
		room: text('room').notNull().default('')
	},
	(t) => [unique().on(t.userId, t.classId, t.date, t.period)]
);

export * from './auth.schema';
```

Note: the JS identifier is `klass` / `module` but the SQL table names are `class` / `module`. `module` is fine as a Drizzle export name.

- [ ] **Step 3: Push the schema to the database**

Run: `bun run db:push`
Expected: drizzle-kit reports the new tables created with no errors. (Requires a valid `DATABASE_URL` in `.env`.)

- [ ] **Step 4: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/auth.schema.ts
git commit -m "feat(db): add planck domain schema"
```

---

## Phase 1 — Pure scheduling logic (no DB)

### Task 2: Date helpers

**Files:**
- Create: `src/lib/scheduling/dates.ts`
- Test: `src/lib/scheduling/dates.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scheduling/dates.spec.ts
import { describe, it, expect } from 'vitest';
import { addDays, dayOfWeekIso, mondayOf, eachDate, isWeekday } from './dates';

describe('dates', () => {
	it('addDays crosses month boundaries', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('dayOfWeekIso returns 1=Mon..7=Sun', () => {
		expect(dayOfWeekIso('2026-09-14')).toBe(1); // Monday
		expect(dayOfWeekIso('2026-09-20')).toBe(7); // Sunday
	});

	it('mondayOf snaps to the ISO week start', () => {
		expect(mondayOf('2026-09-16')).toBe('2026-09-14'); // Wed -> Mon
		expect(mondayOf('2026-09-14')).toBe('2026-09-14'); // Mon -> Mon
		expect(mondayOf('2026-09-20')).toBe('2026-09-14'); // Sun -> Mon
	});

	it('eachDate is inclusive of both ends', () => {
		expect(eachDate('2026-09-14', '2026-09-16')).toEqual([
			'2026-09-14',
			'2026-09-15',
			'2026-09-16'
		]);
	});

	it('isWeekday is false at weekends', () => {
		expect(isWeekday('2026-09-14')).toBe(true);
		expect(isWeekday('2026-09-19')).toBe(false); // Saturday
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/dates.spec.ts`
Expected: FAIL — cannot find module `./dates`.

- [ ] **Step 3: Implement**

```ts
// src/lib/scheduling/dates.ts
export type IsoDate = string; // 'YYYY-MM-DD'
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1=Mon..7=Sun

function toUtc(d: IsoDate): Date {
	return new Date(`${d}T00:00:00Z`);
}

function fromUtc(d: Date): IsoDate {
	return d.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
	const date = toUtc(d);
	date.setUTCDate(date.getUTCDate() + n);
	return fromUtc(date);
}

export function dayOfWeekIso(d: IsoDate): DayOfWeek {
	const js = toUtc(d).getUTCDay(); // 0=Sun..6=Sat
	return (js === 0 ? 7 : js) as DayOfWeek;
}

export function mondayOf(d: IsoDate): IsoDate {
	return addDays(d, -(dayOfWeekIso(d) - 1));
}

export function eachDate(start: IsoDate, end: IsoDate): IsoDate[] {
	const out: IsoDate[] = [];
	for (let cur = start; cur <= end; cur = addDays(cur, 1)) out.push(cur);
	return out;
}

export function isWeekday(d: IsoDate): boolean {
	return dayOfWeekIso(d) <= 5;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/dates.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/dates.ts src/lib/scheduling/dates.spec.ts
git commit -m "feat(scheduling): add UTC date helpers"
```

---

### Task 3: Shared scheduling types

**Files:**
- Create: `src/lib/scheduling/types.ts`

This task has no test of its own (types only); it is consumed by later tested tasks.

- [ ] **Step 1: Create the types**

```ts
// src/lib/scheduling/types.ts
import type { IsoDate, DayOfWeek } from './dates';

export type WeekLetter = 'A' | 'B';

export interface TimetableConfigData {
	cycleWeeks: 1 | 2;
	teachingDays: DayOfWeek[]; // e.g. [1,2,3,4,5]
	periodsPerDay: number;
	anchorLetter: WeekLetter; // letter of the first teaching week
}

export interface TeachingBlockData {
	startDate: IsoDate;
	endDate: IsoDate;
}

export interface SlotData {
	weekLetter: WeekLetter;
	dayOfWeek: DayOfWeek;
	period: number;
	classId: number;
	room: string;
}

export interface PeriodOccurrence {
	date: IsoDate;
	period: number;
	room: string;
}

export interface LessonData {
	id: number;
	title: string;
}

export interface Placement {
	lessonId: number;
	date: IsoDate;
	period: number;
	title: string;
	room: string;
}

export interface AssignmentPlan {
	placements: Placement[];
	unscheduledCount: number;
}
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scheduling/types.ts
git commit -m "feat(scheduling): add shared scheduling types"
```

---

### Task 4: List teaching days

**Files:**
- Create: `src/lib/scheduling/teaching-days.ts`
- Test: `src/lib/scheduling/teaching-days.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scheduling/teaching-days.spec.ts
import { describe, it, expect } from 'vitest';
import { listTeachingDays } from './teaching-days';

const teachingDays = [1, 2, 3, 4, 5] as const;

describe('listTeachingDays', () => {
	it('includes only configured weekdays inside blocks', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-20' }], // Mon..Sun
			[],
			[...teachingDays]
		);
		// Sat 19th and Sun 20th excluded
		expect(result).toEqual([
			'2026-09-14',
			'2026-09-15',
			'2026-09-16',
			'2026-09-17',
			'2026-09-18'
		]);
	});

	it('excludes closure days', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-18' }],
			['2026-09-16'],
			[...teachingDays]
		);
		expect(result).not.toContain('2026-09-16');
		expect(result).toHaveLength(4);
	});

	it('merges multiple blocks in date order and dedupes', () => {
		const result = listTeachingDays(
			[
				{ startDate: '2026-09-21', endDate: '2026-09-22' },
				{ startDate: '2026-09-14', endDate: '2026-09-15' }
			],
			[],
			[...teachingDays]
		);
		expect(result).toEqual(['2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22']);
	});

	it('respects a reduced teaching-day set', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-18' }],
			[],
			[1, 3, 5] // Mon/Wed/Fri only
		);
		expect(result).toEqual(['2026-09-14', '2026-09-16', '2026-09-18']);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/teaching-days.spec.ts`
Expected: FAIL — cannot find module `./teaching-days`.

- [ ] **Step 3: Implement**

```ts
// src/lib/scheduling/teaching-days.ts
import { eachDate, dayOfWeekIso, type IsoDate, type DayOfWeek } from './dates';
import type { TeachingBlockData } from './types';

export function listTeachingDays(
	blocks: TeachingBlockData[],
	closures: IsoDate[],
	teachingDays: DayOfWeek[]
): IsoDate[] {
	const closed = new Set(closures);
	const allowed = new Set(teachingDays);
	const days = new Set<IsoDate>();

	for (const block of blocks) {
		for (const d of eachDate(block.startDate, block.endDate)) {
			if (!allowed.has(dayOfWeekIso(d))) continue;
			if (closed.has(d)) continue;
			days.add(d);
		}
	}

	return [...days].sort();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/teaching-days.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/teaching-days.ts src/lib/scheduling/teaching-days.spec.ts
git commit -m "feat(scheduling): list teaching days from blocks and closures"
```

---

### Task 5: Resolve week letters (A/B cycle)

**Files:**
- Create: `src/lib/scheduling/week-letter.ts`
- Test: `src/lib/scheduling/week-letter.spec.ts`

This implements the binding rule: the A/B cycle advances **once per teaching week**; weeks with no teaching days are skipped; partial weeks still count.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scheduling/week-letter.spec.ts
import { describe, it, expect } from 'vitest';
import { resolveWeekLetters, weekLetterForDate } from './week-letter';

describe('resolveWeekLetters', () => {
	it('alternates A/B across consecutive teaching weeks', () => {
		const teaching = ['2026-09-14', '2026-09-21', '2026-09-28']; // 3 Mondays, 3 weeks
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('B');
		expect(map.get('2026-09-28')).toBe('A');
	});

	it('skips a fully empty week so the cycle resumes (A, holiday, B)', () => {
		// Week of 14th has teaching, week of 21st is holiday (no teaching days),
		// week of 28th has teaching -> should be B, not A.
		const teaching = ['2026-09-14', '2026-09-28'];
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.has('2026-09-21')).toBe(false);
		expect(map.get('2026-09-28')).toBe('B');
	});

	it('a partial week still consumes a letter', () => {
		// Week of 14th has only Mon/Tue (rest closure), still counts as A;
		// next teaching week is B.
		const teaching = ['2026-09-14', '2026-09-15', '2026-09-21'];
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('B');
	});

	it('honours the anchor letter', () => {
		const map = resolveWeekLetters(2, 'B', ['2026-09-14', '2026-09-21']);
		expect(map.get('2026-09-14')).toBe('B');
		expect(map.get('2026-09-21')).toBe('A');
	});

	it('a 1-week cycle is always A', () => {
		const map = resolveWeekLetters(1, 'A', ['2026-09-14', '2026-09-21']);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('A');
	});

	it('weekLetterForDate maps any date via its Monday', () => {
		const map = resolveWeekLetters(2, 'A', ['2026-09-14', '2026-09-21']);
		expect(weekLetterForDate('2026-09-16', map)).toBe('A'); // Wed of week A
		expect(weekLetterForDate('2026-09-23', map)).toBe('B'); // Wed of week B
		expect(weekLetterForDate('2026-12-25', map)).toBeNull();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/week-letter.spec.ts`
Expected: FAIL — cannot find module `./week-letter`.

- [ ] **Step 3: Implement**

```ts
// src/lib/scheduling/week-letter.ts
import { mondayOf, type IsoDate } from './dates';
import type { WeekLetter } from './types';

/**
 * Assigns a WeekLetter to every Monday that begins a teaching week.
 * The cycle advances once per teaching week, in date order. Weeks with no
 * teaching days never appear in `teachingDays` and are therefore skipped.
 */
export function resolveWeekLetters(
	cycleWeeks: 1 | 2,
	anchorLetter: WeekLetter,
	teachingDays: IsoDate[]
): Map<IsoDate, WeekLetter> {
	const mondays: IsoDate[] = [];
	const seen = new Set<IsoDate>();
	for (const d of teachingDays) {
		const m = mondayOf(d);
		if (!seen.has(m)) {
			seen.add(m);
			mondays.push(m);
		}
	}
	mondays.sort();

	const map = new Map<IsoDate, WeekLetter>();
	if (cycleWeeks === 1) {
		for (const m of mondays) map.set(m, 'A');
		return map;
	}

	const other: WeekLetter = anchorLetter === 'A' ? 'B' : 'A';
	mondays.forEach((m, i) => map.set(m, i % 2 === 0 ? anchorLetter : other));
	return map;
}

export function weekLetterForDate(
	d: IsoDate,
	map: Map<IsoDate, WeekLetter>
): WeekLetter | null {
	return map.get(mondayOf(d)) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/week-letter.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/week-letter.ts src/lib/scheduling/week-letter.spec.ts
git commit -m "feat(scheduling): resolve A/B week letters across teaching weeks"
```

---

### Task 6: Build a class's period stream

**Files:**
- Create: `src/lib/scheduling/periods.ts`
- Test: `src/lib/scheduling/periods.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scheduling/periods.spec.ts
import { describe, it, expect } from 'vitest';
import { classPeriodStream } from './periods';
import type { TimetableConfigData, SlotData } from './types';

const config: TimetableConfigData = {
	cycleWeeks: 2,
	teachingDays: [1, 2, 3, 4, 5],
	periodsPerDay: 5,
	anchorLetter: 'A'
};

// Class 10 is taught Mon P1 in week A and Tue P3 in week B.
const slots: SlotData[] = [
	{ weekLetter: 'A', dayOfWeek: 1, period: 1, classId: 10, room: 'S1' },
	{ weekLetter: 'B', dayOfWeek: 2, period: 3, classId: 10, room: 'S2' },
	{ weekLetter: 'A', dayOfWeek: 1, period: 1, classId: 99, room: 'X9' } // other class
];

describe('classPeriodStream', () => {
	it('emits only the target class occurrences, ordered by date then period', () => {
		const stream = classPeriodStream(
			config,
			[{ startDate: '2026-09-14', endDate: '2026-09-25' }], // two weeks Mon..Fri
			[],
			slots,
			10
		);
		expect(stream).toEqual([
			{ date: '2026-09-14', period: 1, room: 'S1' }, // Mon week A
			{ date: '2026-09-22', period: 3, room: 'S2' } // Tue week B
		]);
	});

	it('skips closure days', () => {
		const stream = classPeriodStream(
			config,
			[{ startDate: '2026-09-14', endDate: '2026-09-25' }],
			['2026-09-14'], // close the only week-A Monday
			slots,
			10
		);
		expect(stream).toEqual([{ date: '2026-09-22', period: 3, room: 'S2' }]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/periods.spec.ts`
Expected: FAIL — cannot find module `./periods`.

- [ ] **Step 3: Implement**

```ts
// src/lib/scheduling/periods.ts
import { dayOfWeekIso, mondayOf, type IsoDate } from './dates';
import { listTeachingDays } from './teaching-days';
import { resolveWeekLetters } from './week-letter';
import type {
	TimetableConfigData,
	TeachingBlockData,
	SlotData,
	PeriodOccurrence
} from './types';

export function classPeriodStream(
	config: TimetableConfigData,
	blocks: TeachingBlockData[],
	closures: IsoDate[],
	slots: SlotData[],
	classId: number
): PeriodOccurrence[] {
	const teachingDays = listTeachingDays(blocks, closures, config.teachingDays);
	const weekMap = resolveWeekLetters(config.cycleWeeks, config.anchorLetter, teachingDays);
	const classSlots = slots.filter((s) => s.classId === classId);

	const out: PeriodOccurrence[] = [];
	for (const date of teachingDays) {
		const letter = weekMap.get(mondayOf(date));
		if (!letter) continue;
		const dow = dayOfWeekIso(date);
		const todays = classSlots
			.filter((s) => s.weekLetter === letter && s.dayOfWeek === dow)
			.sort((a, b) => a.period - b.period);
		for (const s of todays) out.push({ date, period: s.period, room: s.room });
	}
	return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/periods.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/periods.ts src/lib/scheduling/periods.spec.ts
git commit -m "feat(scheduling): build a class period stream from the timetable"
```

---

### Task 7: The scheduler (module placement)

**Files:**
- Create: `src/lib/scheduling/scheduler.ts`
- Test: `src/lib/scheduling/scheduler.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/scheduling/scheduler.spec.ts
import { describe, it, expect } from 'vitest';
import { planModuleAssignment } from './scheduler';
import type { PeriodOccurrence, LessonData } from './types';

const stream: PeriodOccurrence[] = [
	{ date: '2026-09-14', period: 1, room: 'S1' },
	{ date: '2026-09-15', period: 2, room: 'S1' },
	{ date: '2026-09-16', period: 3, room: 'S2' },
	{ date: '2026-09-17', period: 1, room: 'S1' }
];

const lessons: LessonData[] = [
	{ id: 101, title: 'L1' },
	{ id: 102, title: 'L2' }
];

describe('planModuleAssignment', () => {
	it('places lessons into the first periods on/after notBefore', () => {
		const plan = planModuleAssignment(stream, lessons, { notBefore: '2026-09-14' });
		expect(plan.unscheduledCount).toBe(0);
		expect(plan.placements).toEqual([
			{ lessonId: 101, date: '2026-09-14', period: 1, title: 'L1', room: 'S1' },
			{ lessonId: 102, date: '2026-09-15', period: 2, title: 'L2', room: 'S1' }
		]);
	});

	it('starts strictly after the last scheduled lesson (append)', () => {
		const plan = planModuleAssignment(stream, lessons, {
			notBefore: '2026-09-14',
			lastScheduled: { date: '2026-09-15', period: 2 }
		});
		expect(plan.placements.map((p) => p.date)).toEqual(['2026-09-16', '2026-09-17']);
	});

	it('ignores periods before notBefore (next teaching day)', () => {
		const plan = planModuleAssignment(stream, lessons, { notBefore: '2026-09-16' });
		expect(plan.placements.map((p) => p.date)).toEqual(['2026-09-16', '2026-09-17']);
	});

	it('reports lessons that did not fit', () => {
		const many: LessonData[] = [
			{ id: 1, title: 'a' },
			{ id: 2, title: 'b' },
			{ id: 3, title: 'c' },
			{ id: 4, title: 'd' },
			{ id: 5, title: 'e' }
		];
		const plan = planModuleAssignment(stream, many, { notBefore: '2026-09-14' });
		expect(plan.placements).toHaveLength(4);
		expect(plan.unscheduledCount).toBe(1);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/scheduler.spec.ts`
Expected: FAIL — cannot find module `./scheduler`.

- [ ] **Step 3: Implement**

```ts
// src/lib/scheduling/scheduler.ts
import type { IsoDate } from './dates';
import type {
	PeriodOccurrence,
	LessonData,
	AssignmentPlan,
	Placement
} from './types';

interface PlanOptions {
	/** Earliest date a lesson may be placed (the next teaching day). */
	notBefore: IsoDate;
	/** The class's last already-scheduled lesson, if any. */
	lastScheduled?: { date: IsoDate; period: number };
}

function isAfter(o: PeriodOccurrence, ref: { date: IsoDate; period: number }): boolean {
	return o.date > ref.date || (o.date === ref.date && o.period > ref.period);
}

export function planModuleAssignment(
	stream: PeriodOccurrence[],
	lessons: LessonData[],
	options: PlanOptions
): AssignmentPlan {
	const available = stream.filter((o) => {
		if (o.date < options.notBefore) return false;
		if (options.lastScheduled && !isAfter(o, options.lastScheduled)) return false;
		return true;
	});

	const placements: Placement[] = [];
	for (let i = 0; i < lessons.length && i < available.length; i++) {
		const slot = available[i];
		const lesson = lessons[i];
		placements.push({
			lessonId: lesson.id,
			date: slot.date,
			period: slot.period,
			title: lesson.title,
			room: slot.room
		});
	}

	return { placements, unscheduledCount: lessons.length - placements.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/scheduler.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/scheduler.ts src/lib/scheduling/scheduler.spec.ts
git commit -m "feat(scheduling): plan module assignment by appending into the period stream"
```

---

## Phase 2 — Auth & app shell

### Task 8: Auth client, login/signup, and route guard

**Files:**
- Create: `src/lib/auth-client.ts`
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/login/+page.server.ts`
- Create: `src/routes/signup/+page.svelte`
- Create: `src/routes/(app)/+layout.server.ts`
- Create: `src/routes/(app)/+layout.svelte`
- Modify: `src/routes/+page.svelte` (redirect root → app)
- Create: `src/routes/+page.server.ts`

- [ ] **Step 1: Create the better-auth client**

```ts
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();
```

- [ ] **Step 2: Guard the app group — load the user or redirect**

```ts
// src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return { user: { id: locals.user.id, name: locals.user.name, email: locals.user.email } };
};
```

- [ ] **Step 3: App shell with the six-item nav**

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

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

<div class="flex min-h-screen">
	<nav class="flex w-48 flex-col gap-1 border-r border-gray-200 p-3">
		<span class="mb-3 px-2 text-lg font-bold">planck</span>
		{#each links as link (link.href)}
			<a
				href={link.href}
				class="rounded px-2 py-1 hover:bg-gray-100"
				class:bg-gray-200={page.url.pathname.startsWith(link.href)}
			>
				{link.label}
			</a>
		{/each}
		<button class="mt-auto rounded px-2 py-1 text-left hover:bg-gray-100" onclick={signOut}>
			Sign out
		</button>
	</nav>
	<main class="flex-1 p-6">
		{@render children()}
	</main>
</div>
```

- [ ] **Step 4: Login page**

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

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
</script>

<form class="mx-auto mt-24 flex max-w-sm flex-col gap-3" onsubmit={submit}>
	<h1 class="text-xl font-bold">Sign in to planck</h1>
	<input class="rounded border p-2" type="email" placeholder="Email" bind:value={email} required />
	<input
		class="rounded border p-2"
		type="password"
		placeholder="Password"
		bind:value={password}
		required
	/>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
	<button class="rounded bg-blue-600 p-2 text-white" type="submit">Sign in</button>
	<a class="text-sm text-blue-600" href="/signup">Need an account? Sign up</a>
</form>
```

- [ ] **Step 5: Redirect already-authed users away from login**

```ts
// src/routes/login/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(303, '/agenda');
};
```

- [ ] **Step 6: Signup page**

```svelte
<!-- src/routes/signup/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

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
</script>

<form class="mx-auto mt-24 flex max-w-sm flex-col gap-3" onsubmit={submit}>
	<h1 class="text-xl font-bold">Create your planck account</h1>
	<input class="rounded border p-2" placeholder="Name" bind:value={name} required />
	<input class="rounded border p-2" type="email" placeholder="Email" bind:value={email} required />
	<input
		class="rounded border p-2"
		type="password"
		placeholder="Password"
		bind:value={password}
		required
	/>
	{#if error}<p class="text-sm text-red-600">{error}</p>{/if}
	<button class="rounded bg-blue-600 p-2 text-white" type="submit">Sign up</button>
	<a class="text-sm text-blue-600" href="/login">Have an account? Sign in</a>
</form>
```

- [ ] **Step 7: Root redirect**

```ts
// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	throw redirect(303, locals.user ? '/agenda' : '/login');
};
```

Replace `src/routes/+page.svelte` contents with a minimal placeholder (it will never render due to the redirect):

```svelte
<!-- src/routes/+page.svelte -->
<p>Redirecting…</p>
```

- [ ] **Step 8: Verify the guard manually**

Run: `bun run dev`, open `/agenda` while signed out.
Expected: redirected to `/login`. After signing up, redirected to `/agenda` (which 404s until Task 16 — that's fine; the redirect itself is what we're verifying). Run each Svelte file in this task through the `svelte-autofixer` until clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth-client.ts src/routes/login src/routes/signup "src/routes/(app)" src/routes/+page.svelte src/routes/+page.server.ts
git commit -m "feat(auth): add login/signup, app shell, and route guard"
```

---

## Phase 3 — Persistence helpers & session utility

### Task 9: Session helper and timetable/term queries

**Files:**
- Create: `src/lib/server/session.ts`
- Create: `src/lib/server/queries/timetable.ts`

- [ ] **Step 1: Session helper**

```ts
// src/lib/server/session.ts
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/** Returns the signed-in user's id or throws a 401. */
export function requireUserId(event: { locals: App.Locals }): string {
	if (!event.locals.user) throw error(401, 'Not signed in');
	return event.locals.user.id;
}
```

- [ ] **Step 2: Timetable + term queries**

```ts
// src/lib/server/queries/timetable.ts
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	timetableConfig,
	teachingBlock,
	closureDay,
	timetableSlot
} from '$lib/server/db/schema';
import type { DayOfWeek } from '$lib/scheduling/dates';
import type { WeekLetter } from '$lib/scheduling/types';

const DEFAULT_CONFIG = {
	cycleWeeks: 2 as 1 | 2,
	teachingDays: [1, 2, 3, 4, 5] as DayOfWeek[],
	periodsPerDay: 5,
	anchorLetter: 'A' as WeekLetter
};

export async function getConfig(userId: string) {
	const [row] = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.userId, userId));
	if (!row) return { ...DEFAULT_CONFIG };
	return {
		cycleWeeks: row.cycleWeeks as 1 | 2,
		teachingDays: row.teachingDays as DayOfWeek[],
		periodsPerDay: row.periodsPerDay,
		anchorLetter: row.anchorLetter as WeekLetter
	};
}

export async function upsertConfig(
	userId: string,
	data: {
		cycleWeeks: number;
		teachingDays: number[];
		periodsPerDay: number;
		anchorLetter: string;
	}
) {
	await db
		.insert(timetableConfig)
		.values({ userId, ...data })
		.onConflictDoUpdate({ target: timetableConfig.userId, set: data });
}

export function getBlocks(userId: string) {
	return db
		.select()
		.from(teachingBlock)
		.where(eq(teachingBlock.userId, userId))
		.orderBy(teachingBlock.startDate);
}

export function addBlock(userId: string, name: string, startDate: string, endDate: string) {
	return db.insert(teachingBlock).values({ userId, name, startDate, endDate });
}

export function deleteBlock(userId: string, id: number) {
	return db.delete(teachingBlock).where(and(eq(teachingBlock.userId, userId), eq(teachingBlock.id, id)));
}

export function getClosures(userId: string) {
	return db
		.select()
		.from(closureDay)
		.where(eq(closureDay.userId, userId))
		.orderBy(closureDay.date);
}

export function addClosure(userId: string, date: string) {
	return db.insert(closureDay).values({ userId, date });
}

export function deleteClosure(userId: string, id: number) {
	return db.delete(closureDay).where(and(eq(closureDay.userId, userId), eq(closureDay.id, id)));
}

export function getSlots(userId: string) {
	return db.select().from(timetableSlot).where(eq(timetableSlot.userId, userId));
}

export async function setSlot(
	userId: string,
	data: { weekLetter: string; dayOfWeek: number; period: number; classId: number; room: string }
) {
	await db
		.insert(timetableSlot)
		.values({ userId, ...data })
		.onConflictDoUpdate({
			target: [timetableSlot.userId, timetableSlot.weekLetter, timetableSlot.dayOfWeek, timetableSlot.period],
			set: { classId: data.classId, room: data.room }
		});
}

export function clearSlot(userId: string, weekLetter: string, dayOfWeek: number, period: number) {
	return db
		.delete(timetableSlot)
		.where(
			and(
				eq(timetableSlot.userId, userId),
				eq(timetableSlot.weekLetter, weekLetter),
				eq(timetableSlot.dayOfWeek, dayOfWeek),
				eq(timetableSlot.period, period)
			)
		);
}
```

- [ ] **Step 3: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/session.ts src/lib/server/queries/timetable.ts
git commit -m "feat(server): add session helper and timetable/term queries"
```

---

### Task 10: Course, class, and schedule queries

**Files:**
- Create: `src/lib/server/queries/courses.ts`
- Create: `src/lib/server/queries/classes.ts`
- Create: `src/lib/server/queries/schedule.ts`

- [ ] **Step 1: Course/module/lesson queries (with reorder)**

```ts
// src/lib/server/queries/courses.ts
import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { course, module, lesson } from '$lib/server/db/schema';

export function listCourses(userId: string) {
	return db.select().from(course).where(eq(course.userId, userId)).orderBy(course.name);
}

export function createCourse(userId: string, name: string, colour: string) {
	return db.insert(course).values({ userId, name, colour });
}

export function updateCourse(userId: string, id: number, name: string, colour: string) {
	return db
		.update(course)
		.set({ name, colour })
		.where(and(eq(course.userId, userId), eq(course.id, id)));
}

export function deleteCourse(userId: string, id: number) {
	return db.delete(course).where(and(eq(course.userId, userId), eq(course.id, id)));
}

export async function getCourse(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(course)
		.where(and(eq(course.userId, userId), eq(course.id, id)));
	return row ?? null;
}

export function listModules(userId: string, courseId: number) {
	return db
		.select()
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, courseId)))
		.orderBy(module.orderIndex);
}

export async function createModule(userId: string, courseId: number, name: string) {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${module.orderIndex}) + 1, 0)` })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, courseId)));
	return db.insert(module).values({ userId, courseId, name, orderIndex: next });
}

export function renameModule(userId: string, id: number, name: string) {
	return db.update(module).set({ name }).where(and(eq(module.userId, userId), eq(module.id, id)));
}

export function deleteModule(userId: string, id: number) {
	return db.delete(module).where(and(eq(module.userId, userId), eq(module.id, id)));
}

/** Persists an explicit ordering: ids in their new order. */
export async function reorderModules(userId: string, orderedIds: number[]) {
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(module)
				.set({ orderIndex: i })
				.where(and(eq(module.userId, userId), eq(module.id, orderedIds[i])));
		}
	});
}

export async function getModule(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.id, id)));
	return row ?? null;
}

export function listLessons(userId: string, moduleId: number) {
	return db
		.select()
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, moduleId)))
		.orderBy(lesson.orderIndex);
}

export async function createLesson(userId: string, moduleId: number, title: string) {
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${lesson.orderIndex}) + 1, 0)` })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, moduleId)));
	return db.insert(lesson).values({ userId, moduleId, title, orderIndex: next });
}

export function renameLesson(userId: string, id: number, title: string) {
	return db.update(lesson).set({ title }).where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
}

export function deleteLesson(userId: string, id: number) {
	return db.delete(lesson).where(and(eq(lesson.userId, userId), eq(lesson.id, id)));
}

export async function reorderLessons(userId: string, orderedIds: number[]) {
	await db.transaction(async (tx) => {
		for (let i = 0; i < orderedIds.length; i++) {
			await tx
				.update(lesson)
				.set({ orderIndex: i })
				.where(and(eq(lesson.userId, userId), eq(lesson.id, orderedIds[i])));
		}
	});
}
```

- [ ] **Step 2: Class queries**

```ts
// src/lib/server/queries/classes.ts
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { klass, course } from '$lib/server/db/schema';

export function listClasses(userId: string) {
	return db
		.select({
			id: klass.id,
			name: klass.name,
			courseId: klass.courseId,
			courseName: course.name,
			colour: course.colour
		})
		.from(klass)
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(eq(klass.userId, userId))
		.orderBy(klass.name);
}

export function createClass(userId: string, name: string, courseId: number) {
	return db.insert(klass).values({ userId, name, courseId });
}

export function updateClass(userId: string, id: number, name: string, courseId: number) {
	return db
		.update(klass)
		.set({ name, courseId })
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
}

export function deleteClass(userId: string, id: number) {
	return db.delete(klass).where(and(eq(klass.userId, userId), eq(klass.id, id)));
}

export async function getClass(userId: string, id: number) {
	const [row] = await db
		.select()
		.from(klass)
		.where(and(eq(klass.userId, userId), eq(klass.id, id)));
	return row ?? null;
}
```

- [ ] **Step 3: Schedule queries + the assign orchestration**

```ts
// src/lib/server/queries/schedule.ts
import { eq, and, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { getConfig, getBlocks, getClosures, getSlots } from './timetable';
import { getModule, listLessons } from './courses';
import { getClass } from './classes';
import { classPeriodStream } from '$lib/scheduling/periods';
import { planModuleAssignment } from '$lib/scheduling/scheduler';
import { addDays } from '$lib/scheduling/dates';
import type { SlotData } from '$lib/scheduling/types';

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export interface AssignResult {
	scheduled: number;
	unscheduled: number;
	firstDate: string | null;
	lastDate: string | null;
}

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

	const [config, blocks, closures, slots, lessons] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId),
		getSlots(userId),
		listLessons(userId, moduleId)
	]);
	if (lessons.length === 0) return { scheduled: 0, unscheduled: 0, firstDate: null, lastDate: null };

	const stream = classPeriodStream(
		config,
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		slots as SlotData[],
		classId
	);

	const [last] = await db
		.select({ date: scheduledLesson.date, period: scheduledLesson.period })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, classId)))
		.orderBy(desc(scheduledLesson.date), desc(scheduledLesson.period))
		.limit(1);

	const plan = planModuleAssignment(stream, lessons, {
		notBefore: addDays(today, 1),
		lastScheduled: last ?? undefined
	});

	if (plan.placements.length > 0) {
		await db.insert(scheduledLesson).values(
			plan.placements.map((p) => ({
				userId,
				classId,
				lessonId: p.lessonId,
				moduleId,
				date: p.date,
				period: p.period,
				title: p.title,
				room: p.room
			}))
		);
	}

	return {
		scheduled: plan.placements.length,
		unscheduled: plan.unscheduledCount,
		firstDate: plan.placements[0]?.date ?? null,
		lastDate: plan.placements.at(-1)?.date ?? null
	};
}

export function unscheduleModule(userId: string, moduleId: number, classId: number) {
	return db
		.delete(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				eq(scheduledLesson.moduleId, moduleId),
				eq(scheduledLesson.classId, classId)
			)
		);
}

export function deleteScheduledLesson(userId: string, id: number) {
	return db
		.delete(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

export async function moveScheduledLesson(
	userId: string,
	id: number,
	date: string,
	period: number,
	room: string
) {
	await db
		.update(scheduledLesson)
		.set({ date, period, room })
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
}

/** Upcoming scheduled lessons (today onward), joined with class + course. */
export function listUpcoming(userId: string, from: string = todayIso()) {
	return db
		.select({
			id: scheduledLesson.id,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			moduleId: scheduledLesson.moduleId,
			classId: scheduledLesson.classId,
			className: klass.name,
			courseName: course.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(scheduledLesson.userId, userId)))
		.orderBy(scheduledLesson.date, scheduledLesson.period);
}
```

Note: `listUpcoming` filters to `from` onward in the load function (drizzle `gte`); it is left unfiltered here so the calendar can also request past weeks. Callers pass a date range.

- [ ] **Step 4: Type-check**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/queries/courses.ts src/lib/server/queries/classes.ts src/lib/server/queries/schedule.ts
git commit -m "feat(server): add course, class, and schedule queries + assign orchestration"
```

---

## Phase 4 — Settings (config + term dates)

### Task 11: Settings page

**Files:**
- Create: `src/routes/(app)/settings/+page.server.ts`
- Create: `src/routes/(app)/settings/+page.svelte`

- [ ] **Step 1: Load + actions**

```ts
// src/routes/(app)/settings/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getConfig,
	upsertConfig,
	getBlocks,
	addBlock,
	deleteBlock,
	getClosures,
	addClosure,
	deleteClosure
} from '$lib/server/queries/timetable';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [config, blocks, closures] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId)
	]);
	return { config, blocks, closures };
};

export const actions: Actions = {
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
	},
	addBlock: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addBlock(
			userId,
			String(form.get('name')),
			String(form.get('startDate')),
			String(form.get('endDate'))
		);
	},
	deleteBlock: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteBlock(userId, Number(form.get('id')));
	},
	addClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addClosure(userId, String(form.get('date')));
	},
	deleteClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteClosure(userId, Number(form.get('id')));
	}
};
```

- [ ] **Step 2: Settings UI**

```svelte
<!-- src/routes/(app)/settings/+page.svelte -->
<script lang="ts">
	let { data } = $props();
	const dayNames = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	];
</script>

<h1 class="mb-4 text-2xl font-bold">Settings</h1>

<section class="mb-8">
	<h2 class="mb-2 text-lg font-semibold">Timetable</h2>
	<form method="POST" action="?/saveConfig" class="flex flex-col gap-3">
		<label
			>Cycle length
			<select name="cycleWeeks" class="ml-2 rounded border p-1">
				<option value="1" selected={data.config.cycleWeeks === 1}>1 week</option>
				<option value="2" selected={data.config.cycleWeeks === 2}>2 weeks</option>
			</select>
		</label>
		<label
			>Periods per day
			<input
				name="periodsPerDay"
				type="number"
				min="1"
				max="10"
				value={data.config.periodsPerDay}
				class="ml-2 w-16 rounded border p-1"
			/>
		</label>
		<label
			>First teaching week is
			<select name="anchorLetter" class="ml-2 rounded border p-1">
				<option value="A" selected={data.config.anchorLetter === 'A'}>Week A</option>
				<option value="B" selected={data.config.anchorLetter === 'B'}>Week B</option>
			</select>
		</label>
		<fieldset class="flex gap-3">
			<legend class="font-medium">Teaching days</legend>
			{#each dayNames as d (d.n)}
				<label class="flex items-center gap-1">
					<input
						type="checkbox"
						name="teachingDays"
						value={d.n}
						checked={data.config.teachingDays.includes(d.n)}
					/>
					{d.label}
				</label>
			{/each}
		</fieldset>
		<button class="w-32 rounded bg-blue-600 p-2 text-white">Save</button>
	</form>
</section>

<section class="mb-8">
	<h2 class="mb-2 text-lg font-semibold">Teaching blocks</h2>
	<ul class="mb-2">
		{#each data.blocks as b (b.id)}
			<li class="flex items-center gap-3 py-1">
				<span class="font-medium">{b.name}</span>
				<span class="text-sm text-gray-600">{b.startDate} → {b.endDate}</span>
				<form method="POST" action="?/deleteBlock">
					<input type="hidden" name="id" value={b.id} />
					<button class="text-sm text-red-600">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addBlock" class="flex items-end gap-2">
		<input name="name" placeholder="Autumn 1" required class="rounded border p-1" />
		<input name="startDate" type="date" required class="rounded border p-1" />
		<input name="endDate" type="date" required class="rounded border p-1" />
		<button class="rounded bg-gray-800 p-1 px-3 text-white">Add block</button>
	</form>
</section>

<section>
	<h2 class="mb-2 text-lg font-semibold">Closure days (INSET / bank holidays)</h2>
	<ul class="mb-2">
		{#each data.closures as c (c.id)}
			<li class="flex items-center gap-3 py-1">
				<span>{c.date}</span>
				<form method="POST" action="?/deleteClosure">
					<input type="hidden" name="id" value={c.id} />
					<button class="text-sm text-red-600">Delete</button>
				</form>
			</li>
		{/each}
	</ul>
	<form method="POST" action="?/addClosure" class="flex items-end gap-2">
		<input name="date" type="date" required class="rounded border p-1" />
		<button class="rounded bg-gray-800 p-1 px-3 text-white">Add closure</button>
	</form>
</section>
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` on the component until clean. Then `bun run dev`, sign in, visit `/settings`, save config, add a teaching block and a closure day; reload and confirm they persist.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/settings"
git commit -m "feat(settings): timetable config and term dates"
```

---

## Phase 5 — Courses, modules, lessons

### Task 12: Courses list and course detail (modules)

**Files:**
- Create: `src/routes/(app)/courses/+page.server.ts`
- Create: `src/routes/(app)/courses/+page.svelte`
- Create: `src/routes/(app)/courses/[courseId]/+page.server.ts`
- Create: `src/routes/(app)/courses/[courseId]/+page.svelte`

- [ ] **Step 1: Courses list — load + actions**

```ts
// src/routes/(app)/courses/+page.server.ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	listCourses,
	createCourse,
	updateCourse,
	deleteCourse
} from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	return { courses: await listCourses(userId) };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const name = String(form.get('name')).trim();
		if (!name) throw error(400, 'Name required');
		await createCourse(userId, name, String(form.get('colour') || '#3884ff'));
	},
	update: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateCourse(userId, Number(form.get('id')), String(form.get('name')), String(form.get('colour')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteCourse(userId, Number(form.get('id')));
	}
};
```

- [ ] **Step 2: Courses list UI**

```svelte
<!-- src/routes/(app)/courses/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold">Courses</h1>

<ul class="mb-6 flex flex-col gap-2">
	{#each data.courses as c (c.id)}
		<li class="flex items-center gap-3">
			<span class="inline-block h-4 w-4 rounded" style="background:{c.colour}"></span>
			<a class="font-medium text-blue-700 hover:underline" href="/courses/{c.id}">{c.name}</a>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={c.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="flex items-end gap-2">
	<input name="name" placeholder="GCSE Chemistry" required class="rounded border p-1" />
	<input name="colour" type="color" value="#3884ff" class="h-8 w-10 rounded border" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add course</button>
</form>
```

- [ ] **Step 3: Course detail (modules) — load + actions**

```ts
// src/routes/(app)/courses/[courseId]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getCourse,
	listModules,
	createModule,
	renameModule,
	deleteModule,
	reorderModules
} from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const courseId = Number(event.params.courseId);
	const course = await getCourse(userId, courseId);
	if (!course) throw error(404, 'Course not found');
	return { course, modules: await listModules(userId, courseId) };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await createModule(userId, Number(event.params.courseId), String(form.get('name')).trim());
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await renameModule(userId, Number(form.get('id')), String(form.get('name')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteModule(userId, Number(form.get('id')));
	},
	reorder: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const ids = String(form.get('orderedIds')).split(',').map(Number);
		await reorderModules(userId, ids);
	}
};
```

- [ ] **Step 4: Course detail UI (with up/down reorder)**

Reorder is exposed as up/down buttons that submit the full new order to the `reorder` action. (Drag-and-drop can be layered on later; the action contract — an ordered id list — does not change.)

```svelte
<!-- src/routes/(app)/courses/[courseId]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.modules.map((m) => m.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses" class="text-sm text-blue-600">← Courses</a>
<h1 class="mb-4 text-2xl font-bold">{data.course.name}</h1>

<ul class="mb-6 flex flex-col gap-1">
	{#each data.modules as m, i (m.id)}
		<li class="flex items-center gap-2">
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
				<button class="px-1" disabled={i === 0} aria-label="Move up">↑</button>
			</form>
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
				<button class="px-1" disabled={i === data.modules.length - 1} aria-label="Move down">↓</button>
			</form>
			<a class="font-medium text-blue-700 hover:underline" href="/courses/{data.course.id}/modules/{m.id}">
				{m.name}
			</a>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={m.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="flex items-end gap-2">
	<input name="name" placeholder="Forces" required class="rounded border p-1" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add module</button>
</form>
```

- [ ] **Step 5: Verify**

Run `svelte-autofixer` on both components until clean. `bun run dev`: create a course, open it, add modules, reorder with ↑/↓, delete one. Confirm order persists across reload.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/courses/+page.server.ts" "src/routes/(app)/courses/+page.svelte" "src/routes/(app)/courses/[courseId]/+page.server.ts" "src/routes/(app)/courses/[courseId]/+page.svelte"
git commit -m "feat(courses): course list and module management"
```

---

### Task 13: Module detail (lessons) with assign action

**Files:**
- Create: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.server.ts`
- Create: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`

- [ ] **Step 1: Load + actions (lessons CRUD/reorder + assign-to-class)**

```ts
// src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.server.ts
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getModule,
	listLessons,
	createLesson,
	renameLesson,
	deleteLesson,
	reorderLessons
} from '$lib/server/queries/courses';
import { listClasses } from '$lib/server/queries/classes';
import { assignModule } from '$lib/server/queries/schedule';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const moduleId = Number(event.params.moduleId);
	const mod = await getModule(userId, moduleId);
	if (!mod) throw error(404, 'Module not found');
	const allClasses = await listClasses(userId);
	return {
		module: mod,
		lessons: await listLessons(userId, moduleId),
		// only classes whose course matches this module's course can be assigned
		classes: allClasses.filter((c) => c.courseId === mod.courseId)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await createLesson(userId, Number(event.params.moduleId), String(form.get('title')).trim());
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await renameLesson(userId, Number(form.get('id')), String(form.get('title')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteLesson(userId, Number(form.get('id')));
	},
	reorder: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await reorderLessons(userId, String(form.get('orderedIds')).split(',').map(Number));
	},
	assign: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const classId = Number(form.get('classId'));
		try {
			const result = await assignModule(userId, Number(event.params.moduleId), classId);
			return { assigned: result };
		} catch (e) {
			return fail(400, { assignError: (e as Error).message });
		}
	}
};
```

- [ ] **Step 2: Lessons UI + assign control**

```svelte
<!-- src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	function reorderedIds(index: number, dir: -1 | 1): string {
		const ids = data.lessons.map((l) => l.id);
		const target = index + dir;
		if (target < 0 || target >= ids.length) return ids.join(',');
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<a href="/courses/{data.module.courseId}" class="text-sm text-blue-600">← Modules</a>
<h1 class="mb-4 text-2xl font-bold">{data.module.name}</h1>

<ul class="mb-6 flex flex-col gap-1">
	{#each data.lessons as l, i (l.id)}
		<li class="flex items-center gap-2">
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, -1)} />
				<button class="px-1" disabled={i === 0} aria-label="Move up">↑</button>
			</form>
			<form method="POST" action="?/reorder" use:enhance>
				<input type="hidden" name="orderedIds" value={reorderedIds(i, 1)} />
				<button class="px-1" disabled={i === data.lessons.length - 1} aria-label="Move down">↓</button>
			</form>
			<span>{i + 1}. {l.title}</span>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={l.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

<form method="POST" action="?/create" class="mb-8 flex items-end gap-2">
	<input name="title" placeholder="L1: Intro to forces" required class="rounded border p-1" />
	<button class="rounded bg-blue-600 p-1 px-3 text-white">Add lesson</button>
</form>

<section class="rounded border border-gray-200 p-4">
	<h2 class="mb-2 text-lg font-semibold">Schedule this module</h2>
	{#if data.classes.length === 0}
		<p class="text-sm text-gray-600">No classes study this course yet. Create one under Classes.</p>
	{:else}
		<form method="POST" action="?/assign" use:enhance class="flex items-end gap-2">
			<label
				>Class
				<select name="classId" class="ml-2 rounded border p-1">
					{#each data.classes as c (c.id)}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			</label>
			<button class="rounded bg-green-700 p-1 px-3 text-white">Assign</button>
		</form>
	{/if}

	{#if form?.assigned}
		<p class="mt-2 text-sm text-green-700">
			Scheduled {form.assigned.scheduled} lessons
			{#if form.assigned.firstDate}({form.assigned.firstDate} → {form.assigned.lastDate}){/if}.
			{#if form.assigned.unscheduled > 0}
				{form.assigned.unscheduled} did not fit before the end of your teaching blocks.
			{/if}
		</p>
	{/if}
	{#if form?.assignError}
		<p class="mt-2 text-sm text-red-600">{form.assignError}</p>
	{/if}
</section>
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` until clean. (Full assign flow is exercised end-to-end in Task 16/19, once classes and the timetable exist.)

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/modules"
git commit -m "feat(courses): lesson management and assign-module-to-class"
```

---

## Phase 6 — Classes

### Task 14: Classes page

**Files:**
- Create: `src/routes/(app)/classes/+page.server.ts`
- Create: `src/routes/(app)/classes/+page.svelte`

- [ ] **Step 1: Load + actions**

```ts
// src/routes/(app)/classes/+page.server.ts
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { listClasses, createClass, updateClass, deleteClass } from '$lib/server/queries/classes';
import { listCourses } from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [classes, courses] = await Promise.all([listClasses(userId), listCourses(userId)]);
	return { classes, courses };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const name = String(form.get('name')).trim();
		const courseId = Number(form.get('courseId'));
		if (!name || !courseId) throw error(400, 'Name and course required');
		await createClass(userId, name, courseId);
	},
	update: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateClass(userId, Number(form.get('id')), String(form.get('name')), Number(form.get('courseId')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteClass(userId, Number(form.get('id')));
	}
};
```

- [ ] **Step 2: Classes UI**

```svelte
<!-- src/routes/(app)/classes/+page.svelte -->
<script lang="ts">
	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold">Classes</h1>

<ul class="mb-6 flex flex-col gap-2">
	{#each data.classes as c (c.id)}
		<li class="flex items-center gap-3">
			<span class="inline-block h-4 w-4 rounded" style="background:{c.colour}"></span>
			<span class="font-medium">{c.name}</span>
			<span class="text-sm text-gray-600">{c.courseName}</span>
			<form method="POST" action="?/delete" class="ml-auto">
				<input type="hidden" name="id" value={c.id} />
				<button class="text-sm text-red-600">Delete</button>
			</form>
		</li>
	{/each}
</ul>

{#if data.courses.length === 0}
	<p class="text-sm text-gray-600">Create a course first.</p>
{:else}
	<form method="POST" action="?/create" class="flex items-end gap-2">
		<input name="name" placeholder="10Phy1" required class="rounded border p-1" />
		<select name="courseId" class="rounded border p-1">
			{#each data.courses as course (course.id)}
				<option value={course.id}>{course.name}</option>
			{/each}
		</select>
		<button class="rounded bg-blue-600 p-1 px-3 text-white">Add class</button>
	</form>
{/if}
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` until clean. `bun run dev`: create a class tied to a course; confirm it lists with the course name and colour.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/classes"
git commit -m "feat(classes): class CRUD tied to a course"
```

---

## Phase 7 — Timetable builder

### Task 15: Timetable grid

**Files:**
- Create: `src/routes/(app)/timetable/+page.server.ts`
- Create: `src/routes/(app)/timetable/+page.svelte`

- [ ] **Step 1: Load + actions**

```ts
// src/routes/(app)/timetable/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getConfig, getSlots, setSlot, clearSlot } from '$lib/server/queries/timetable';
import { listClasses } from '$lib/server/queries/classes';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [config, slots, classes] = await Promise.all([
		getConfig(userId),
		getSlots(userId),
		listClasses(userId)
	]);
	return { config, slots, classes };
};

export const actions: Actions = {
	set: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const classId = Number(form.get('classId'));
		const weekLetter = String(form.get('weekLetter'));
		const dayOfWeek = Number(form.get('dayOfWeek'));
		const period = Number(form.get('period'));
		if (!classId) {
			await clearSlot(userId, weekLetter, dayOfWeek, period);
			return;
		}
		await setSlot(userId, {
			weekLetter,
			dayOfWeek,
			period,
			classId,
			room: String(form.get('room') ?? '')
		});
	}
};
```

- [ ] **Step 2: Grid UI (Week A/B tabs, click a cell to assign class + room)**

```svelte
<!-- src/routes/(app)/timetable/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	let week = $state<'A' | 'B'>('A');
	const days = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	].filter((d) => data.config.teachingDays.includes(d.n));
	const periods = Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1);

	function slotFor(dayOfWeek: number, period: number) {
		return data.slots.find(
			(s) => s.weekLetter === week && s.dayOfWeek === dayOfWeek && s.period === period
		);
	}
	function classById(id: number) {
		return data.classes.find((c) => c.id === id);
	}
</script>

<h1 class="mb-4 text-2xl font-bold">Timetable</h1>

{#if data.config.cycleWeeks === 2}
	<div class="mb-3 flex gap-2">
		<button class="rounded px-3 py-1" class:bg-gray-200={week === 'A'} onclick={() => (week = 'A')}>
			Week A
		</button>
		<button class="rounded px-3 py-1" class:bg-gray-200={week === 'B'} onclick={() => (week = 'B')}>
			Week B
		</button>
	</div>
{/if}

<table class="border-collapse">
	<thead>
		<tr>
			<th class="border p-2"></th>
			{#each days as d (d.n)}<th class="border p-2">{d.label}</th>{/each}
		</tr>
	</thead>
	<tbody>
		{#each periods as p (p)}
			<tr>
				<th class="border p-2">P{p}</th>
				{#each days as d (d.n)}
					{@const slot = slotFor(d.n, p)}
					{@const cls = slot ? classById(slot.classId) : undefined}
					<td class="border p-1 align-top">
						<form method="POST" action="?/set" use:enhance class="flex flex-col gap-1">
							<input type="hidden" name="weekLetter" value={week} />
							<input type="hidden" name="dayOfWeek" value={d.n} />
							<input type="hidden" name="period" value={p} />
							<select
								name="classId"
								class="w-28 rounded border text-sm"
								style={cls ? `background:${cls.colour}22` : ''}
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
								class="w-28 rounded border text-sm"
								onblur={(e) => e.currentTarget.form?.requestSubmit()}
							/>
						</form>
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
<p class="mt-2 text-sm text-gray-600">Pick a class to assign a cell; choose "— free —" to clear it.</p>
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` until clean. `bun run dev`: assign classes to cells in Week A and Week B, set rooms; reload and confirm persistence. Selecting "— free —" clears the cell.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/timetable"
git commit -m "feat(timetable): week A/B grid builder with rooms"
```

---

## Phase 8 — Agenda (default view)

### Task 16: Agenda page

**Files:**
- Create: `src/lib/scheduling/week-label.ts`
- Create: `src/lib/scheduling/week-label.spec.ts`
- Create: `src/routes/(app)/agenda/+page.server.ts`
- Create: `src/routes/(app)/agenda/+page.svelte`

- [ ] **Step 1: Write the failing test for a date-grouping helper**

```ts
// src/lib/scheduling/week-label.spec.ts
import { describe, it, expect } from 'vitest';
import { groupByDate } from './week-label';

describe('groupByDate', () => {
	it('groups items by their date in order', () => {
		const items = [
			{ date: '2026-09-14', period: 2, label: 'b' },
			{ date: '2026-09-14', period: 1, label: 'a' },
			{ date: '2026-09-15', period: 1, label: 'c' }
		];
		const groups = groupByDate(items);
		expect(groups.map((g) => g.date)).toEqual(['2026-09-14', '2026-09-15']);
		expect(groups[0].items.map((i) => i.period)).toEqual([1, 2]); // sorted by period
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:unit -- --run src/lib/scheduling/week-label.spec.ts`
Expected: FAIL — cannot find module `./week-label`.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/scheduling/week-label.ts
import type { IsoDate } from './dates';

export function groupByDate<T extends { date: IsoDate; period: number }>(
	items: T[]
): { date: IsoDate; items: T[] }[] {
	const byDate = new Map<IsoDate, T[]>();
	for (const item of items) {
		const list = byDate.get(item.date) ?? [];
		list.push(item);
		byDate.set(item.date, list);
	}
	return [...byDate.keys()]
		.sort()
		.map((date) => ({ date, items: byDate.get(date)!.sort((a, b) => a.period - b.period) }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:unit -- --run src/lib/scheduling/week-label.spec.ts`
Expected: PASS.

- [ ] **Step 5: Agenda load (today onward)**

```ts
// src/routes/(app)/agenda/+page.server.ts
import { gte, and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { todayIso } from '$lib/server/queries/schedule';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';
import { groupByDate } from '$lib/scheduling/week-label';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const today = todayIso();

	const rows = await db
		.select({
			id: scheduledLesson.id,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			className: klass.name,
			courseName: course.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(and(eq(scheduledLesson.userId, userId), gte(scheduledLesson.date, today)))
		.orderBy(scheduledLesson.date, scheduledLesson.period);

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

	const groups = groupByDate(rows).map((g) => ({
		...g,
		weekLetter: weekLetterForDate(g.date, weekMap)
	}));
	return { groups };
};
```

- [ ] **Step 6: Agenda UI (default landing view, includes room)**

```svelte
<!-- src/routes/(app)/agenda/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();

	const dayFmt = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
	function label(d: string) {
		return dayFmt.format(new Date(`${d}T00:00:00Z`));
	}
</script>

<h1 class="mb-4 text-2xl font-bold">Agenda</h1>

{#if data.groups.length === 0}
	<p class="text-gray-600">No upcoming lessons. Assign a module to a class to fill your agenda.</p>
{/if}

{#each data.groups as g (g.date)}
	<h2 class="mt-5 mb-1 border-b pb-1 font-semibold">
		{label(g.date)}
		{#if g.weekLetter}<span class="text-sm font-normal text-gray-500">· Week {g.weekLetter}</span>{/if}
	</h2>
	{#each g.items as item (item.id)}
		<div class="flex items-center gap-3 border-b border-dashed py-1.5 text-sm">
			<span class="w-8 font-bold text-gray-500">P{item.period}</span>
			<span class="inline-block h-3 w-3 rounded" style="background:{item.colour}"></span>
			<span class="w-16 font-bold">{item.className}</span>
			<span class="flex-1">{item.courseName} — {item.title}</span>
			<span class="text-gray-500">{item.room}</span>
			<form
				method="POST"
				action="/agenda?/deleteLesson"
				use:enhance
			>
				<input type="hidden" name="id" value={item.id} />
				<button class="text-xs text-red-600">Delete</button>
			</form>
		</div>
	{/each}
{/each}
```

Note: the `deleteLesson` action is added in Task 18; the delete button is wired now but the action arrives next. (If executing strictly task-by-task, the button will 404 until Task 18 — acceptable.)

- [ ] **Step 7: Verify**

Run `svelte-autofixer` on the agenda component until clean. `bun run test:unit -- --run src/lib/scheduling/week-label.spec.ts` passes. With a course/module/lessons, a class, and a timetable in place, assign the module and confirm lessons appear grouped by day with period, class, course, title, room, and the correct Week A/B label.

- [ ] **Step 8: Commit**

```bash
git add src/lib/scheduling/week-label.ts src/lib/scheduling/week-label.spec.ts "src/routes/(app)/agenda"
git commit -m "feat(agenda): default upcoming-lessons view grouped by day"
```

---

## Phase 9 — Calendar view

### Task 17: Calendar grid view

**Files:**
- Create: `src/routes/(app)/calendar/+page.server.ts`
- Create: `src/routes/(app)/calendar/+page.svelte`

The calendar shows one cycle-week's worth of dates as a day × period grid. It steps by week using a `start` query param (the Monday to show).

- [ ] **Step 1: Load (a week window)**

```ts
// src/routes/(app)/calendar/+page.server.ts
import { gte, lte, and, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { scheduledLesson, klass, course } from '$lib/server/db/schema';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { mondayOf, addDays } from '$lib/scheduling/dates';
import { todayIso } from '$lib/server/queries/schedule';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const startParam = event.url.searchParams.get('start');
	const weekStart = mondayOf(startParam ?? todayIso());
	const weekEnd = addDays(weekStart, 6);

	const rows = await db
		.select({
			id: scheduledLesson.id,
			date: scheduledLesson.date,
			period: scheduledLesson.period,
			title: scheduledLesson.title,
			room: scheduledLesson.room,
			className: klass.name,
			colour: course.colour
		})
		.from(scheduledLesson)
		.innerJoin(klass, eq(scheduledLesson.classId, klass.id))
		.innerJoin(course, eq(klass.courseId, course.id))
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				gte(scheduledLesson.date, weekStart),
				lte(scheduledLesson.date, weekEnd)
			)
		);

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

	return {
		config,
		weekStart,
		prevStart: addDays(weekStart, -7),
		nextStart: addDays(weekStart, 7),
		weekLetter: weekLetterForDate(weekStart, weekMap),
		lessons: rows
	};
};
```

- [ ] **Step 2: Calendar UI**

```svelte
<!-- src/routes/(app)/calendar/+page.svelte -->
<script lang="ts">
	import { addDays } from '$lib/scheduling/dates';
	let { data } = $props();

	const days = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' }
	].filter((d) => data.config.teachingDays.includes(d.n));
	const periods = Array.from({ length: data.config.periodsPerDay }, (_, i) => i + 1);

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

<div class="mb-3 flex items-center gap-3">
	<h1 class="text-2xl font-bold">Calendar</h1>
	{#if data.weekLetter}<span class="rounded bg-gray-200 px-2 py-0.5 text-sm">Week {data.weekLetter}</span>{/if}
	<a class="ml-auto rounded border px-2 py-1 text-sm" href="?start={data.prevStart}">← Prev</a>
	<a class="rounded border px-2 py-1 text-sm" href="?start={data.nextStart}">Next →</a>
</div>

<table class="w-full border-collapse">
	<thead>
		<tr>
			<th class="border p-2"></th>
			{#each days as d (d.n)}
				<th class="border p-2 text-sm">{d.label}<br /><span class="font-normal text-gray-500">{fmt(dateFor(d.n))}</span></th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each periods as p (p)}
			<tr>
				<th class="border p-2">P{p}</th>
				{#each days as d (d.n)}
					{@const l = cell(d.n, p)}
					<td class="h-14 border p-1 align-top text-xs" style={l ? `background:${l.colour}22` : ''}>
						{#if l}
							<div class="font-bold">{l.className}</div>
							<div class="opacity-80">{l.title}</div>
							<div class="text-gray-500">{l.room}</div>
						{:else}
							<span class="text-gray-300">—</span>
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` until clean. `bun run dev`: open `/calendar`, confirm the week grid renders scheduled lessons in the right cells, the Week A/B badge matches, and Prev/Next step by week.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/calendar"
git commit -m "feat(calendar): weekly day x period grid view"
```

---

## Phase 10 — Move & delete scheduled lessons

### Task 18: Edit scheduled lessons (move + delete + unschedule)

**Files:**
- Create: `src/routes/(app)/agenda/+page.server.ts` actions (modify the file from Task 16 — add `export const actions`)
- Modify: `src/routes/(app)/agenda/+page.svelte` (add a move control)

- [ ] **Step 1: Add actions to the agenda server file**

Append to `src/routes/(app)/agenda/+page.server.ts`. That file (from Task 16) **already imports** `gte, and, eq` from `drizzle-orm`, `db`, `scheduledLesson, klass, course` from the schema, and `requireUserId`. Do **not** re-import those. Add only these new imports at the top, then add the `actions` export:

```ts
// add to the existing import block — new symbols only
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getSlots } from '$lib/server/queries/timetable';
import { deleteScheduledLesson, moveScheduledLesson } from '$lib/server/queries/schedule';
import { dayOfWeekIso } from '$lib/scheduling/dates';
```

```ts
export const actions: Actions = {
	deleteLesson: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteScheduledLesson(userId, Number(form.get('id')));
	},
	moveLesson: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const date = String(form.get('date'));
		const period = Number(form.get('period'));

		// Look up the lesson's class, and the room of the target slot for that class.
		const [row] = await db
			.select({ classId: scheduledLesson.classId })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, id)));
		if (!row) return fail(404, { moveError: 'Lesson not found' });

		const slots = await getSlots(userId);
		const dow = dayOfWeekIso(date);
		// Target must be a timetabled period for this class on that weekday (either week letter).
		const target = slots.find((s) => s.classId === row.classId && s.dayOfWeek === dow && s.period === period);
		if (!target) return fail(400, { moveError: 'That period is not timetabled for this class' });

		// Enforce "free period" — refuse if the class already has a lesson there.
		const [clash] = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(
				and(
					eq(scheduledLesson.userId, userId),
					eq(scheduledLesson.classId, row.classId),
					eq(scheduledLesson.date, date),
					eq(scheduledLesson.period, period)
				)
			);
		if (clash && clash.id !== id) return fail(400, { moveError: 'That period is already taken' });

		await moveScheduledLesson(userId, id, date, period, target.room);
	}
};
```

Note: the move targets a specific calendar **date** the teacher types, plus a period; validation confirms the class is actually timetabled that weekday/period and the slot is free. This keeps the room snapshot correct and honours the spec's "free timetabled period only, no cascade" rule.

- [ ] **Step 2: Add a move control to each agenda row**

In `src/routes/(app)/agenda/+page.svelte`, replace the delete `<form>` block inside the row with both a move and delete control:

```svelte
<div class="flex items-center gap-1">
	<form method="POST" action="/agenda?/moveLesson" use:enhance class="flex items-center gap-1">
		<input type="hidden" name="id" value={item.id} />
		<input type="date" name="date" required class="rounded border text-xs" />
		<input type="number" name="period" min="1" placeholder="P" required class="w-12 rounded border text-xs" />
		<button class="text-xs text-blue-600">Move</button>
	</form>
	<form method="POST" action="/agenda?/deleteLesson" use:enhance>
		<input type="hidden" name="id" value={item.id} />
		<button class="text-xs text-red-600">Delete</button>
	</form>
</div>
```

Add near the top of the markup, after the `<h1>`, a place to surface move errors:

```svelte
{#if form?.moveError}<p class="mb-2 text-sm text-red-600">{form.moveError}</p>{/if}
```

And update the script's props to include `form`:

```svelte
let { data, form } = $props();
```

- [ ] **Step 3: Verify**

Run `svelte-autofixer` until clean. `bun run dev`: from the agenda, delete a scheduled lesson (it disappears); move one to another timetabled free period for that class (it relocates with the new room); attempt to move onto an occupied or non-timetabled period (error shown, no change).

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/agenda"
git commit -m "feat(agenda): move and delete individual scheduled lessons"
```

---

## Phase 11 — End-to-end happy path

### Task 19: Playwright happy-path test

**Files:**
- Create: `e2e/happy-path.test.ts`
- Reference: `playwright.config.ts` (already present)

This test drives the full loop against a running dev server with a real database. It uses a unique email per run so it can be re-run.

- [ ] **Step 1: Write the e2e test**

```ts
// e2e/happy-path.test.ts
import { test, expect } from '@playwright/test';

test('plan and schedule a module end to end', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up
	await page.goto('/signup');
	await page.getByPlaceholder('Name').fill('Test Teacher');
	await page.getByPlaceholder('Email').fill(email);
	await page.getByPlaceholder('Password').fill('password123');
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Settings: a teaching block spanning the next ~4 weeks
	const today = new Date();
	const start = new Date(today);
	start.setDate(start.getDate() + 1);
	const end = new Date(today);
	end.setDate(end.getDate() + 28);
	const iso = (d: Date) => d.toISOString().slice(0, 10);

	await page.goto('/settings');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByPlaceholder('Autumn 1').fill('Block 1');
	await page.locator('input[name="startDate"]').fill(iso(start));
	await page.locator('input[name="endDate"]').fill(iso(end));
	await page.getByRole('button', { name: 'Add block' }).click();

	// Course
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();

	// Class tied to that course
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill('10Phy1');
	await page.selectOption('select[name="courseId"]', { label: 'GCSE Physics' });
	await page.getByRole('button', { name: 'Add class' }).click();

	// Timetable: put 10Phy1 in Mon P1 (week A)
	await page.goto('/timetable');
	const monP1 = page.locator('tbody tr').first().locator('td').first();
	await monP1.locator('select[name="classId"]').selectOption({ label: '10Phy1' });

	// Module + lessons
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Forces').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	for (const t of ['L1 Intro', 'L2 Friction']) {
		await page.getByPlaceholder('L1: Intro to forces').fill(t);
		await page.getByRole('button', { name: 'Add lesson' }).click();
	}

	// Assign to the class
	await page.selectOption('select[name="classId"]', { label: '10Phy1' });
	await page.getByRole('button', { name: 'Assign' }).click();
	await expect(page.getByText(/Scheduled 2 lessons/)).toBeVisible();

	// Agenda shows the scheduled lessons
	await page.goto('/agenda');
	await expect(page.getByText('Forces — L1 Intro')).toBeVisible();
	await expect(page.getByText('10Phy1').first()).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test**

Run: `bun run test:e2e -- happy-path`
Expected: PASS. (Requires `DATABASE_URL` set and reachable; the Playwright config starts the dev server.)

- [ ] **Step 3: Run the whole unit suite once more**

Run: `bun run test:unit -- --run`
Expected: all scheduling specs PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/happy-path.test.ts
git commit -m "test(e2e): full plan-and-schedule happy path"
```

---

## Done — definition of complete

- All unit specs pass (`bun run test:unit -- --run`): dates, teaching-days, week-letter, periods, scheduler, week-label.
- The e2e happy path passes.
- A teacher can: sign up → set term dates + timetable shape → build a timetable → create courses/modules/lessons → create classes → assign a module → see lessons on the agenda (default) and calendar → move/delete individual scheduled lessons.
- Every screen's Svelte was passed through `svelte-autofixer` until clean.

## Mapping to the spec (coverage)

- Data model → Task 1.
- Cycle/week-letter rules (teaching-week counting, skip empty weeks, partial weeks count) → Tasks 5, plus consumed in 6/16/17.
- Teaching blocks + closure days → Tasks 1, 9, 11.
- Append-based scheduling, start next teaching day, run-out warning → Task 7 + 10 (`assignModule`).
- One course per class enforced at assign time + class creation → Tasks 10, 13, 14.
- Snapshot (title + room copied), no re-sync → Task 10 (`assignModule` copies title/room; no re-sync action exists anywhere).
- Move (free timetabled period only) + delete + unschedule → Tasks 10, 18.
- Agenda (default, shows room) + Calendar → Tasks 16, 17.
- Six-item nav + auth guard → Task 8.
- Out-of-scope items are simply not built.
