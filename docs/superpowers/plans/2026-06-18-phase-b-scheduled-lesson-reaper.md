# Phase B — Scheduled-Lesson Reaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily Vercel-Cron reaper that purges each teacher's scheduled lessons older than their (configurable) previous academic-year start, reclaiming any now-unreferenced blobs via Phase A's `deleteAndReclaim`.

**Architecture:** A pure `academicYearCutoff` date helper computes the per-user retention boundary; a pure `isAuthorizedCron` guards a new `GET /api/cron/reap-scheduled-lessons` endpoint (Bearer `CRON_SECRET`, fail-closed). The endpoint iterates users with scheduled lessons, computes each cutoff from their `timetable_config` academic-year start, and reaps the oldest rows (global per-run cap 500) through `reapScheduledLessonsBefore`, which routes deletion through Phase A's reference-counted reclamation. The academic-year start is editable from `/settings`.

**Tech Stack:** SvelteKit (server endpoints + form actions), Drizzle ORM (neon-http, no transactions — uses `db.batch`/ordered deletes), Vercel Cron + Vercel Blob, Vitest (unit), Playwright (e2e against a forked Neon `test` branch).

**Context:** Phase A (#24, merged) made blobs reference-counted and reclaimed on every delete path, and flipped `scheduled_lesson.lesson_id`/`module_id` to `set null`. Without a reaper, scheduled-lesson history (and its blobs) grows forever. This plan implements Layer 2 of `docs/superpowers/specs/2026-06-18-orphaned-blob-cleanup-design.md`. Retention rule: cutoff = **previous academic year's start**; lessons dated strictly before it are purged (keeps current + previous year). The reaper deletes only the frozen past prefix — it never reallocates.

---

## File map

- Create: `src/lib/scheduling/dates.ts` (extend) — `daysInMonth`, `academicYearCutoff`.
- Create: `src/lib/server/cron-auth.ts` — `isAuthorizedCron`, `CronAuth`.
- Modify: `src/lib/server/db/schema.ts` — two `timetable_config` columns.
- Generate: `drizzle/<n>_*.sql` — committed migration.
- Modify: `src/lib/server/queries/timetable.ts` — config read/write/default.
- Modify: `src/lib/server/queries/schedule.ts` — `reapScheduledLessonsBefore`.
- Create: `src/routes/api/cron/reap-scheduled-lessons/+server.ts` — endpoint.
- Modify: `src/routes/(app)/settings/+page.server.ts` + `+page.svelte` — year-start UI.
- Modify: `vercel.json`, `.env.example`, `scripts/setup-test-branch.ts`.
- Create: `e2e/helpers/db.ts`, `e2e/reaper.e2e.ts`.

Test commands: unit `bun run test:unit -- --run`; e2e `bun run db:test:setup` then `bun run test:e2e`; types/lint `bun run check` / `bun run lint`.

---

## Task 1: `academicYearCutoff` + `daysInMonth` (pure date helpers)

**Files:**
- Modify: `src/lib/scheduling/dates.ts`
- Test: `src/lib/scheduling/dates.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/scheduling/dates.spec.ts` (and add the two names to the existing import on line 2: `import { addDays, dayOfWeekIso, mondayOf, eachDate, isWeekday, daysInMonth, academicYearCutoff } from './dates';`):

```ts
describe('daysInMonth', () => {
	it('returns month lengths, Feb as 29 (leap-tolerant)', () => {
		expect(daysInMonth(1)).toBe(31);
		expect(daysInMonth(2)).toBe(29);
		expect(daysInMonth(4)).toBe(30);
	});
});

describe('academicYearCutoff', () => {
	it('returns the previous academic-year start (default 1 Sept)', () => {
		// today is before this year's 1 Sept → current year started last 1 Sept
		expect(academicYearCutoff('2026-06-18', 9, 1)).toBe('2024-09-01');
	});

	it('rolls forward once today reaches the start date', () => {
		expect(academicYearCutoff('2026-09-01', 9, 1)).toBe('2025-09-01');
		expect(academicYearCutoff('2026-10-15', 9, 1)).toBe('2025-09-01');
		expect(academicYearCutoff('2026-08-31', 9, 1)).toBe('2024-09-01');
	});

	it('handles a January start', () => {
		expect(academicYearCutoff('2026-06-18', 1, 1)).toBe('2025-01-01');
	});

	it('clamps a 29-Feb start into a non-leap cutoff year', () => {
		// today 2026-06-18, start 29 Feb: current start clamps to 2026-02-28,
		// cutoff year 2025 is non-leap → 2025-02-28
		expect(academicYearCutoff('2026-06-18', 2, 29)).toBe('2025-02-28');
	});

	it('keeps 29 Feb when the cutoff year is a leap year', () => {
		// today 2025-06-18, start 29 Feb: current start 2025-02-28, cutoff 2024 (leap)
		expect(academicYearCutoff('2025-06-18', 2, 29)).toBe('2024-02-29');
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:unit -- --run src/lib/scheduling/dates.spec.ts`
Expected: FAIL — `daysInMonth`/`academicYearCutoff` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/scheduling/dates.ts`:

```ts
function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/** Days in `month` (1–12) for calendar `year`, leap-year aware. */
function daysInMonthOfYear(year: number, month: number): number {
	// Date.UTC's month arg is 0-indexed, so `month` (1-indexed) is next month;
	// day 0 of next month is the last day of the desired month.
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Max days in `month` (1–12), Feb counted as 29 (year-agnostic; for validation). */
export function daysInMonth(month: number): number {
	return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Build an IsoDate, clamping `day` to the month's real length that year. */
function makeDate(year: number, month: number, day: number): IsoDate {
	return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonthOfYear(year, month)))}`;
}

/**
 * The retention cutoff: the start of the PREVIOUS academic year. Scheduled
 * lessons dated strictly before this are purged (keep current + previous year).
 * `startMonth`/`startDay` define the academic-year boundary (default 9/1).
 */
export function academicYearCutoff(
	today: IsoDate,
	startMonth: number,
	startDay: number
): IsoDate {
	const year = Number(today.slice(0, 4));
	const thisYearStart = makeDate(year, startMonth, startDay);
	// The most recent year-start on/before today is the current academic year.
	const currentStartYear = today >= thisYearStart ? year : year - 1;
	return makeDate(currentStartYear - 1, startMonth, startDay);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:unit -- --run src/lib/scheduling/dates.spec.ts`
Expected: PASS (all cases, including both leap-year cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scheduling/dates.ts src/lib/scheduling/dates.spec.ts
git commit -m "feat: academicYearCutoff + daysInMonth date helpers"
```

---

## Task 2: `isAuthorizedCron` (pure cron auth guard)

**Files:**
- Create: `src/lib/server/cron-auth.ts`
- Test: `src/lib/server/cron-auth.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/cron-auth.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isAuthorizedCron } from './cron-auth';

describe('isAuthorizedCron', () => {
	it('fails closed (503) when the secret is unset or empty', () => {
		expect(isAuthorizedCron('Bearer x', undefined)).toEqual({ authorized: false, status: 503 });
		expect(isAuthorizedCron('Bearer x', '')).toEqual({ authorized: false, status: 503 });
	});

	it('rejects a missing or mismatched bearer (401)', () => {
		expect(isAuthorizedCron(null, 's3cret')).toEqual({ authorized: false, status: 401 });
		expect(isAuthorizedCron('Bearer wrong', 's3cret')).toEqual({ authorized: false, status: 401 });
		expect(isAuthorizedCron('s3cret', 's3cret')).toEqual({ authorized: false, status: 401 });
	});

	it('authorizes an exact Bearer match', () => {
		expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toEqual({ authorized: true });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test:unit -- --run src/lib/server/cron-auth.spec.ts`
Expected: FAIL — module `./cron-auth` not found.

- [ ] **Step 3: Implement the guard**

Create `src/lib/server/cron-auth.ts`:

```ts
export type CronAuth = { authorized: true } | { authorized: false; status: 401 | 503 };

/** Constant-time-ish string equality: no early return on a per-char mismatch. */
function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/**
 * Authorize a cron request. Fails closed: a missing/empty secret yields 503 (the
 * job is misconfigured, never purge); a missing or wrong bearer yields 401.
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically.
 */
export function isAuthorizedCron(header: string | null, secret: string | undefined): CronAuth {
	if (!secret) return { authorized: false, status: 503 };
	if (!header || !safeEqual(header, `Bearer ${secret}`)) {
		return { authorized: false, status: 401 };
	}
	return { authorized: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test:unit -- --run src/lib/server/cron-auth.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/cron-auth.ts src/lib/server/cron-auth.spec.ts
git commit -m "feat: isAuthorizedCron fail-closed cron guard"
```

---

## Task 3: Schema columns + migration

**Files:**
- Modify: `src/lib/server/db/schema.ts:4-11`
- Generate: `drizzle/*.sql` (+ snapshot/journal)

- [ ] **Step 1: Add the columns**

In `src/lib/server/db/schema.ts`, change the `timetableConfig` table (currently ends at the `anchorLetter` line) to add two columns:

```ts
export const timetableConfig = pgTable('timetable_config', {
	id: serial('id').primaryKey(),
	userId: text('user_id').notNull().unique(),
	cycleWeeks: integer('cycle_weeks').notNull().default(2),
	teachingDays: integer('teaching_days').array().notNull().default([1, 2, 3, 4, 5]),
	periodsPerDay: integer('periods_per_day').notNull().default(5),
	anchorLetter: text('anchor_letter').notNull().default('A'),
	academicYearStartMonth: integer('academic_year_start_month').notNull().default(9),
	academicYearStartDay: integer('academic_year_start_day').notNull().default(1)
});
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new file under `drizzle/` adding both columns with defaults 9 and 1. Inspect it to confirm it only `ALTER TABLE "timetable_config" ADD COLUMN ...` (no destructive changes, no FK churn).

- [ ] **Step 3: Verify types still compile**

Run: `bun run check`
Expected: no errors.

- [ ] **Step 4: Commit (code + generated migration together)**

```bash
git add src/lib/server/db/schema.ts drizzle/
git commit -m "feat: add academic_year_start_{month,day} to timetable_config"
```

---

## Task 4: Config read/write/default

**Files:**
- Modify: `src/lib/server/queries/timetable.ts:7-39`

- [ ] **Step 1: Extend `DEFAULT_CONFIG`, `getConfig`, `upsertConfig`**

In `src/lib/server/queries/timetable.ts`:

Add to `DEFAULT_CONFIG`:

```ts
const DEFAULT_CONFIG = {
	cycleWeeks: 2 as 1 | 2,
	teachingDays: [1, 2, 3, 4, 5] as DayOfWeek[],
	periodsPerDay: 5,
	anchorLetter: 'A' as WeekLetter,
	academicYearStartMonth: 9,
	academicYearStartDay: 1
};
```

Add the two fields to the object `getConfig` returns from a row:

```ts
	return {
		cycleWeeks: row.cycleWeeks as 1 | 2,
		teachingDays: row.teachingDays as DayOfWeek[],
		periodsPerDay: row.periodsPerDay,
		anchorLetter: row.anchorLetter as WeekLetter,
		academicYearStartMonth: row.academicYearStartMonth,
		academicYearStartDay: row.academicYearStartDay
	};
```

Extend `upsertConfig`'s `data` parameter type (the `set:`/`values:` spread already carries the new keys):

```ts
export async function upsertConfig(
	userId: string,
	data: {
		cycleWeeks: number;
		teachingDays: number[];
		periodsPerDay: number;
		anchorLetter: string;
		academicYearStartMonth: number;
		academicYearStartDay: number;
	}
) {
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: errors in `settings/+page.server.ts` (the `upsertConfig` call there now misses the two new fields). That is fixed in Task 7 — acceptable mid-plan, but to keep each commit green, do Task 7 before committing, OR commit with `--no-verify` only after Task 7. **Recommendation: leave this uncommitted and commit it together with Task 7.**

---

## Task 5: `reapScheduledLessonsBefore` query

**Files:**
- Modify: `src/lib/server/queries/schedule.ts:1` (imports) and append a new export.

- [ ] **Step 1: Add imports**

Change the first import line of `src/lib/server/queries/schedule.ts` to include `inArray` and `isNotNull`:

```ts
import { eq, and, sql, lt, gte, or, isNull, isNotNull, inArray } from 'drizzle-orm';
```

- [ ] **Step 2: Add the reaper query**

Append to `src/lib/server/queries/schedule.ts`:

```ts
/**
 * Purge up to `limit` of this user's OLDEST scheduled lessons dated strictly
 * before `cutoff`, reclaiming any blobs that lose their last reference (Phase A).
 * Returns the number of rows purged. The DELETE is id-driven (not predicate-
 * driven) because the candidate set is capped by `limit`.
 */
export async function reapScheduledLessonsBefore(
	userId: string,
	cutoff: string,
	limit: number
): Promise<number> {
	if (limit <= 0) return 0;
	const rows = await db
		.select({ id: scheduledLesson.id })
		.from(scheduledLesson)
		.where(
			and(
				eq(scheduledLesson.userId, userId),
				isNotNull(scheduledLesson.date),
				lt(scheduledLesson.date, cutoff)
			)
		)
		.orderBy(scheduledLesson.date)
		.limit(limit);
	if (rows.length === 0) return 0;
	const ids = rows.map((r) => r.id);
	await deleteAndReclaim(userId, { type: 'scheduledLessons', ids }, () =>
		db
			.delete(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), inArray(scheduledLesson.id, ids)))
	);
	return ids.length;
}
```

(`deleteAndReclaim` is already imported at the top of this file from `./resource-cleanup`.)

- [ ] **Step 3: Verify types compile**

Run: `bun run check`
Expected: no new errors from `schedule.ts` (the Task 4 settings error may still be pending until Task 7).

- [ ] **Step 4: Commit (Tasks 4 + 5 together with Task 7's settings fix)**

Defer the commit until after Task 7 so the tree type-checks. (See Task 7, Step 6.)

---

## Task 6: Cron endpoint

**Files:**
- Create: `src/routes/api/cron/reap-scheduled-lessons/+server.ts`

- [ ] **Step 1: Implement the endpoint**

Create `src/routes/api/cron/reap-scheduled-lessons/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { scheduledLesson } from '$lib/server/db/schema';
import { getConfig } from '$lib/server/queries/timetable';
import { reapScheduledLessonsBefore, todayIso } from '$lib/server/queries/schedule';
import { academicYearCutoff } from '$lib/scheduling/dates';
import { isAuthorizedCron } from '$lib/server/cron-auth';
import type { RequestHandler } from './$types';

// Global cap per invocation; the daily schedule drains any first-run backlog.
const PER_RUN_CAP = 500;

export const GET: RequestHandler = async ({ request }) => {
	const auth = isAuthorizedCron(request.headers.get('authorization'), env.CRON_SECRET);
	if (!auth.authorized) return new Response(null, { status: auth.status });

	const today = todayIso();
	const users = await db.selectDistinct({ userId: scheduledLesson.userId }).from(scheduledLesson);

	let reaped = 0;
	let remaining = PER_RUN_CAP;
	for (const { userId } of users) {
		if (remaining <= 0) break;
		try {
			const config = await getConfig(userId);
			const cutoff = academicYearCutoff(
				today,
				config.academicYearStartMonth,
				config.academicYearStartDay
			);
			const n = await reapScheduledLessonsBefore(userId, cutoff, remaining);
			reaped += n;
			remaining -= n;
		} catch (err) {
			// Resilient: one user's failure must not abort the whole run.
			console.error('reap failed for user', userId, err);
		}
	}
	return json({ reaped });
};
```

- [ ] **Step 2: Verify types compile**

Run: `bun run check`
Expected: no errors from the new endpoint (settings error may still pend until Task 7).

- [ ] **Step 3: Commit (with Task 7)**

Defer to Task 7, Step 6.

---

## Task 7: Settings UI for the academic-year start

**Files:**
- Modify: `src/routes/(app)/settings/+page.server.ts:26-40`
- Modify: `src/routes/(app)/settings/+page.svelte`

- [ ] **Step 1: Validate + persist in the `saveConfig` action**

In `src/routes/(app)/settings/+page.server.ts`, add the import:

```ts
import { daysInMonth } from '$lib/scheduling/dates';
```

Replace the `saveConfig` action body's `upsertConfig` call so it parses and clamps the two new fields:

```ts
	saveConfig: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const teachingDays = form
			.getAll('teachingDays')
			.map((d) => Number(d))
			.filter((n) => n >= 1 && n <= 7);
		const startMonth = Math.min(12, Math.max(1, Number(form.get('academicYearStartMonth'))));
		const startDay = Math.min(
			daysInMonth(startMonth),
			Math.max(1, Number(form.get('academicYearStartDay')))
		);
		await upsertConfig(userId, {
			cycleWeeks: Number(form.get('cycleWeeks')),
			teachingDays,
			periodsPerDay: Number(form.get('periodsPerDay')),
			anchorLetter: String(form.get('anchorLetter')),
			academicYearStartMonth: startMonth,
			academicYearStartDay: startDay
		});
		await reallocateAllClasses(userId);
	},
```

- [ ] **Step 2: Add the UI fields**

In `src/routes/(app)/settings/+page.svelte`, add a month-name list near the existing `dayNames` const (top `<script>`):

```ts
	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
```

Then, inside the `?/saveConfig` form, immediately **before** the final `<div class="flex justify-end">` Save button, add:

```svelte
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<Field label="Academic year starts (month)">
				<select name="academicYearStartMonth" class={inputClass}>
					{#each monthNames as name, i (name)}
						<option value={i + 1} selected={data.config.academicYearStartMonth === i + 1}>
							{name}
						</option>
					{/each}
				</select>
			</Field>
			<Field label="Day of month">
				<input
					name="academicYearStartDay"
					type="number"
					min="1"
					max="31"
					value={data.config.academicYearStartDay}
					class={inputClass}
				/>
			</Field>
		</div>
```

- [ ] **Step 3: Run the Svelte autofixer on the edited component**

Use the `mcp__svelte__svelte-autofixer` tool on `src/routes/(app)/settings/+page.svelte`; apply any fixes and re-run until it reports no issues. (Required by the project's Svelte MCP workflow.)

- [ ] **Step 4: Verify the whole tree type-checks**

Run: `bun run check`
Expected: no errors (Task 4's pending `upsertConfig` mismatch is now resolved).

- [ ] **Step 5: Run all unit tests + lint**

Run: `bun run test:unit -- --run && bun run lint`
Expected: all pass; prettier/eslint clean.

- [ ] **Step 6: Commit Tasks 4–7 together**

```bash
git add src/lib/server/queries/timetable.ts src/lib/server/queries/schedule.ts \
  src/routes/api/cron/reap-scheduled-lessons/+server.ts \
  src/routes/(app)/settings/+page.server.ts src/routes/(app)/settings/+page.svelte
git commit -m "feat: reaper query, cron endpoint, and academic-year-start settings"
```

---

## Task 8: Vercel cron + env wiring

**Files:**
- Modify: `vercel.json`
- Modify: `.env.example`
- Modify: `scripts/setup-test-branch.ts` (the `.env.test` writer)

- [ ] **Step 1: Add the cron schedule**

Replace `vercel.json` with:

```json
{
	"$schema": "https://openapi.vercel.sh/vercel.json",
	"buildCommand": "bun run db:migrate && bun run build",
	"crons": [{ "path": "/api/cron/reap-scheduled-lessons", "schedule": "0 3 * * *" }]
}
```

- [ ] **Step 2: Document `CRON_SECRET`**

Append to `.env.example`:

```
# Shared secret for the scheduled-lesson reaper cron. Vercel Cron sends it as
# `Authorization: Bearer $CRON_SECRET`. REQUIRED in production — the endpoint
# fails closed (503) if it is unset, so no purge runs without it.
CRON_SECRET=""
```

- [ ] **Step 3: Have `db:test:setup` write a `CRON_SECRET` into `.env.test`**

In `scripts/setup-test-branch.ts`, in the `writeFileSync('.env.test', [ ... ].join('\n'))` array (step 4 of that script), add two lines before the final `''`:

```ts
		'',
		'# Shared secret so the reaper e2e can authenticate against the cron endpoint.',
		'CRON_SECRET="e2e-cron-secret"',
```

This keeps the secret in `.env.test` across regenerations. `playwright.config.ts` already merges `.env.test` into both the web server env and (via the e2e DB helper) the test process.

- [ ] **Step 4: Verify formatting**

Run: `bun run lint`
Expected: clean (prettier accepts the JSON/TS edits).

- [ ] **Step 5: Commit**

```bash
git add vercel.json .env.example scripts/setup-test-branch.ts
git commit -m "feat: schedule reaper cron and wire CRON_SECRET"
```

---

## Task 9: End-to-end test (real Neon test branch + real blob)

**Files:**
- Create: `e2e/helpers/db.ts`
- Create: `e2e/reaper.e2e.ts`

**Approach:** Create the test fixtures directly via DB insert (deterministic — no dependence on the assign/copy path, no "age the oldest" edge case). A real Vercel blob is created with `@vercel/blob`'s `put` so its 404-on-reclaim is observable.

- [ ] **Step 1: Write the DB helper**

Create `e2e/helpers/db.ts`:

```ts
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/lib/server/db/schema';

const { scheduledLesson, klass, resourceFile } = schema;

/** Minimal KEY=VALUE .env parser (mirrors playwright.config.ts). */
function loadEnv(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const out: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const eq = t.indexOf('=');
		if (eq === -1) continue;
		const key = t.slice(0, eq).trim();
		let val = t.slice(eq + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
			val = val.slice(1, -1);
		out[key] = val;
	}
	return out;
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env.test') };
export const CRON_SECRET = env.CRON_SECRET ?? '';

const url = env.DATABASE_URL;
if (!url) throw new Error('e2e DB helper: DATABASE_URL missing (run `bun run db:test:setup`).');
export const db = drizzle(neon(url), { schema });

/** Find the (userId, classId) of a class the UI just created, by name. */
export async function getClassByName(name: string): Promise<{ userId: string; classId: number }> {
	const [row] = await db
		.select({ userId: klass.userId, classId: klass.id })
		.from(klass)
		.where(eq(klass.name, name));
	if (!row) throw new Error(`No class named ${name}`);
	return row;
}

/** Insert a scheduled lesson with an explicit date; returns its id. */
export async function insertScheduledLesson(opts: {
	userId: string;
	classId: number;
	title: string;
	date: string;
}): Promise<number> {
	const [row] = await db
		.insert(scheduledLesson)
		.values({
			userId: opts.userId,
			classId: opts.classId,
			title: opts.title,
			date: opts.date,
			orderIndex: 0
		})
		.returning({ id: scheduledLesson.id });
	return row.id;
}

/** Attach a resource_file (referencing an existing blob) to a scheduled lesson. */
export async function insertResourceFile(opts: {
	userId: string;
	scheduledLessonId: number;
	blobUrl: string;
	pathname: string;
}): Promise<void> {
	await db.insert(resourceFile).values({
		userId: opts.userId,
		scheduledLessonId: opts.scheduledLessonId,
		blobUrl: opts.blobUrl,
		pathname: opts.pathname,
		filename: 'aged.pdf',
		contentType: 'application/pdf',
		size: 24
	});
}

/** True if a scheduled-lesson row still exists. */
export async function scheduledLessonExists(id: number): Promise<boolean> {
	const rows = await db
		.select({ id: scheduledLesson.id })
		.from(scheduledLesson)
		.where(eq(scheduledLesson.id, id));
	return rows.length > 0;
}
```

- [ ] **Step 2: Write the e2e test**

Create `e2e/reaper.e2e.ts`:

```ts
/// <reference types="node" />
import { test, expect, type Page } from '@playwright/test';
import { put } from '@vercel/blob';
import {
	CRON_SECRET,
	getClassByName,
	insertScheduledLesson,
	insertResourceFile,
	scheduledLessonExists
} from './helpers/db';

const CRON_PATH = '/api/cron/reap-scheduled-lessons';

async function signUp(page: Page) {
	const email = `teacher_${Date.now()}@example.com`;
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);
}

/** Create a subject and a class for it, returning the class name. */
async function createSubjectAndClass(page: Page, subject: string, className: string) {
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByRole('link', { name: subject })).toBeVisible();

	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill(className);
	await page.locator('select[name="courseId"]').selectOption({ label: subject });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByRole('link', { name: className, exact: true })).toBeVisible();
}

test('cron endpoint rejects an unauthenticated request', async ({ request }) => {
	const res = await request.get(CRON_PATH);
	expect(res.status()).toBe(401);
});

test('reaper purges an out-of-retention lesson and its last-reference blob', async ({
	page,
	request
}) => {
	test.skip(!CRON_SECRET, 'CRON_SECRET missing from .env.test (run db:test:setup)');

	await signUp(page);
	const className = `10Reap${Date.now()}`;
	await createSubjectAndClass(page, 'GCSE Reaping', className);
	const { userId, classId } = await getClassByName(className);

	// A real blob, referenced solely by the soon-to-be-reaped scheduled lesson.
	const blob = await put(`e2e/aged-${Date.now()}.pdf`, Buffer.from('%PDF-1.4\n% aged\n'), {
		access: 'public',
		token: process.env.BLOB_READ_WRITE_TOKEN,
		addRandomSuffix: false
	});
	expect((await request.get(blob.url)).ok()).toBe(true);

	// OLD: dated well before any plausible cutoff → must be reaped.
	const oldId = await insertScheduledLesson({
		userId,
		classId,
		title: 'OLD lesson',
		date: '2000-01-01'
	});
	await insertResourceFile({ userId, scheduledLessonId: oldId, blobUrl: blob.url, pathname: blob.pathname });

	// KEEP: dated today → inside retention, must survive.
	const today = new Date().toISOString().slice(0, 10);
	const keepId = await insertScheduledLesson({ userId, classId, title: 'KEEP lesson', date: today });

	// Run the reaper with the cron bearer.
	const res = await request.get(CRON_PATH, {
		headers: { Authorization: `Bearer ${CRON_SECRET}` }
	});
	expect(res.ok()).toBe(true);
	expect((await res.json()).reaped).toBeGreaterThanOrEqual(1);

	// OLD row gone, KEEP row survives.
	expect(await scheduledLessonExists(oldId)).toBe(false);
	expect(await scheduledLessonExists(keepId)).toBe(true);

	// The blob was the last reference → reclaimed (Vercel Blob serves 404).
	await expect.poll(async () => (await request.get(blob.url)).status(), { timeout: 15000 }).toBe(404);
});
```

- [ ] **Step 3: (Re)create the test branch so it has the new columns + secret**

Run: `bun run db:test:setup`
Expected: forks the `test` branch, applies the Task 3 migration, writes `.env.test` containing `CRON_SECRET="e2e-cron-secret"`.

- [ ] **Step 4: Run the e2e suite**

Run: `bun run test:e2e`
Expected: PASS — the new `reaper.e2e.ts` (both tests) and the existing `blob-cleanup.e2e.ts` are green. (Requires `BLOB_READ_WRITE_TOKEN` in `.env`; `bun run` loads `.env` into the test process so `put` and the helper both see it.)

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/db.ts e2e/reaper.e2e.ts
git commit -m "test: e2e reaper purges out-of-retention lessons and blobs"
```

---

## Final verification

- [ ] `bun run test:unit -- --run` — all unit specs pass (incl. `academicYearCutoff`, `isAuthorizedCron`).
- [ ] `bun run check` — no type errors.
- [ ] `bun run lint` — prettier + eslint clean.
- [ ] `git status` shows the generated migration committed under `drizzle/`.
- [ ] `bun run test:e2e` — `reaper.e2e.ts` + `blob-cleanup.e2e.ts` pass.
- [ ] Optional manual smoke: `bun run dev`, set a year start in `/settings`, then
      `curl -H "Authorization: Bearer <secret>" localhost:5173/api/cron/reap-scheduled-lessons`
      → `{"reaped":0}` with no old lessons; an unauthenticated curl returns 401.

## Notes / decisions

- **Per-run cap is global** (500 oldest across all users per invocation); the daily schedule drains any first-run backlog over days.
- **Reaper never reallocates** — it deletes only the frozen past prefix (before the previous academic year); `orderIndex` gaps are harmless.
- **e2e ageing = direct DB insert** of fixtures (user preference): deterministic, decoupled from the assign/copy machinery, no missing-row edge case.
- **Blob-reclaim race** is the accepted, documented Phase A behaviour — unchanged here.
- Commit ordering: Tasks 4–7 land in one commit because Task 4's `upsertConfig` signature change isn't satisfied until Task 7 updates its caller; this keeps every committed tree type-checking.
```
