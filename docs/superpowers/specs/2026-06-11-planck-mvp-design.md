# planck MVP — Design Spec

**Date:** 2026-06-11
**Status:** Approved for planning

## Purpose

planck helps a UK secondary teacher plan and schedule lessons. The teacher
configures their school's term dates and personal timetable, builds reusable
course content (courses → modules → lessons), then assigns a module to a class
to automatically drop its lessons into that class's upcoming timetabled periods.
The payoff is an at-a-glance view of upcoming lessons (agenda and calendar).

This document specifies the first MVP. It is intentionally lean; features not
listed here are out of scope for v1.

## Stack

Already scaffolded in the repo — build on what exists, do not change it:

- SvelteKit (Svelte 5) + TypeScript
- Drizzle ORM on PostgreSQL
- better-auth (per-teacher accounts already wired; the existing `demo/` routes
  are a reference, not part of the product, and may be removed)
- Tailwind CSS v4
- vitest (unit) + Playwright (e2e)

## Core concepts & decisions

These decisions were settled during brainstorming and are binding for the MVP:

1. **Single content hierarchy:** Course → Module → Lesson. No separate "subject"
   layer; "GCSE Chemistry" is just a course name.
2. **One course per class.** A class is tied to exactly one course. A course can
   be reused across many classes.
3. **Ordinal periods, no clock times.** Periods are Period 1..N with no
   start/end times. Views show "P3", not a time.
4. **Two-week cycle by default**, Mon–Fri, configurable period count. Cycle
   length is configurable (1 or 2 weeks).
5. **The A/B cycle counts teaching weeks only.** A week (Mon–Sun) that contains
   at least one teaching day takes the next letter (A, B, A, B…). A week with no
   teaching days is skipped, so the cycle resumes after a break where it left
   off. (Example: Week A → full holiday week skipped → Week B.)
6. **Term model = teaching blocks + closure days.** Each teaching block is a
   date range (e.g. "Autumn 1: 2 Sep – 24 Oct"). Gaps between blocks are
   automatically holidays. Closure days are one-off non-teaching dates inside a
   block (INSET, bank holidays).
7. **Scheduling appends.** Assigning a module places its lessons into the
   class's timetabled periods, starting after the class's last already-scheduled
   lesson (or from the next teaching day if nothing is scheduled).
8. **Scheduling starts from the next teaching day.** Today is never written to,
   because ordinal periods carry no clock time to compare against "now".
9. **Snapshot, no re-sync.** Scheduling copies the lesson title and room into
   ScheduledLesson instances. Editing a module afterwards never changes the
   calendar. To change scheduled lessons: move/delete them individually, or
   unschedule the module and re-assign. (There is deliberately no "re-sync"
   button.)
10. **Per-lesson calendar edits in scope:** move and delete individual
    scheduled lessons.

## Data model

All entities are owned by a `Teacher` (the better-auth user) and scoped to that
account. Every query filters by the authenticated teacher.

- **Teacher** — the better-auth account. Owns everything below.

- **TimetableConfig** — exactly one per teacher.
  - `cycleWeeks` (1 or 2, default 2)
  - `teachingDays` (subset of Mon–Fri; default all five)
  - `periodsPerDay` (integer, e.g. 5)
  - `anchorLetter` (which letter the first teaching week of the year is; for a
    1-week cycle this is irrelevant and the grid has a single week)

- **TeachingBlock** — a teaching date range.
  - `name` (e.g. "Autumn 1")
  - `startDate`, `endDate` (inclusive)
  - Belongs to the teacher. Blocks must not overlap.

- **ClosureDay** — a single non-teaching date.
  - `date`
  - Belongs to the teacher. Represents INSET / bank holidays inside a block.

- **Course**
  - `name` (e.g. "GCSE Chemistry")
  - `colour` (for calendar colour-coding)

- **Module** — belongs to a Course.
  - `name` (e.g. "Forces")
  - `orderIndex` (position within its course)

- **Lesson** — belongs to a Module.
  - `title`
  - `orderIndex` (position within its module)

- **Class** — belongs to exactly one Course.
  - `name` (e.g. "10Phy1")
  - `courseId`

- **TimetableSlot** — a cell in the teacher's timetable grid.
  - `weekLetter` (A or B; always A for a 1-week cycle)
  - `dayOfWeek` (Mon–Fri)
  - `period` (1..periodsPerDay)
  - `classId` (which class is taught in this cell)
  - `room` (string)
  - A cell with no slot row = a free period. Unique per
    (teacher, weekLetter, dayOfWeek, period).

- **ScheduledLesson** — a concrete instance of a lesson on a date, created by
  assigning a module to a class.
  - `classId`
  - `lessonId` (provenance / which lesson this came from)
  - `moduleId` (so a whole module can be unscheduled)
  - `date`
  - `period`
  - `title` (snapshot copy of the lesson title at scheduling time)
  - `room` (snapshot copy from the timetable slot; updates if the lesson is
    moved)
  - Unique per (teacher, classId, date, period) — a class can have only one
    lesson per period.

## Calendar / cycle resolution

A pure module (no DB, fully unit-testable) resolves the timetable grid onto real
dates. Given a teacher's TimetableConfig, TeachingBlocks, and ClosureDays:

- **Teaching day:** a date inside some TeachingBlock, on a configured teaching
  day-of-week, and not a ClosureDay.
- **Week letter:** enumerate weeks (Mon–Sun) from the first teaching week.
  Assign A/B by `cycleWeeks` and `anchorLetter`, **incrementing the counter only
  for weeks that contain at least one teaching day.** Empty weeks are skipped and
  do not advance the cycle.
- **Periods for a class:** for each teaching day, take its week letter, look up
  TimetableSlots for that (letter, day) assigned to the class; each gives a
  (date, period, room). The ordered stream of these — by date then period — is
  the class's timetabled periods.

This module is the single source of truth for "what are this class's upcoming
periods" and is consumed by both the scheduler and the views.

## Scheduling algorithm

`assignModuleToClass(module, class)`:

1. Validate `class.courseId === module.courseId`.
2. Determine the start point: the class's latest existing ScheduledLesson
   (by date, then period). The first target period is the next timetabled period
   for the class strictly after it. If the class has no scheduled lessons, start
   from the first timetabled period on or after the **next teaching day**.
3. Walk the class's timetabled periods forward in order. For each module lesson
   in `orderIndex` order, create a ScheduledLesson at the next period, copying
   `title` and the slot's `room`.
4. Stop when every lesson is placed. If the stream runs out (past the last
   teaching block) before all lessons are placed, create what fits and return a
   warning naming how many lessons could not be scheduled.
5. Return a summary: count scheduled, first date, last date.

**Move** `moveScheduledLesson(instance, targetDate, targetPeriod)`: the target
must be a free (unoccupied) timetabled period for the same class. Relocate the
instance, adopt the target slot's room. Leaves a gap behind; no cascade.

**Delete** `deleteScheduledLesson(instance)`: remove it; leaves a gap.

**Unschedule** `unscheduleModule(module, class)`: delete all ScheduledLessons
for that (module, class).

## Screens & navigation

Left nav with six destinations:

1. **Agenda** (home / default) — chronological upcoming lessons grouped by day.
   Each row: period · class · course — lesson title · room. Focused on
   today/upcoming.
2. **Calendar** — Week A/B day × period grid, colour-coded by course, free
   periods shown, toggle Week A / Week B, step by week.
3. **Courses** — list of courses; create/edit/delete. Drill into a course →
   modules (create/edit/delete/reorder). Drill into a module → lessons
   (create/edit/delete/reorder). Hosts the **Assign module → class** action.
4. **Classes** — list; create/edit/delete; each class has a name + one course.
   A class page shows its scheduled modules and an "assign a module" shortcut.
5. **Timetable** — builder grid (Week A / Week B tabs). Click a cell to assign a
   class + room, or clear it.
6. **Settings** — TimetableConfig (cycle, days, periods, anchor letter) and term
   dates (teaching blocks + closure days).

**Reordering** modules and lessons is drag-and-drop backed by `orderIndex`.

**Assignment flow:** from a course's module, "Assign to class" lists only
classes whose course matches the module's course → confirm → ScheduledLessons
are created and a summary is shown ("12 lessons scheduled, Mon 15 Sep → Tue 7
Oct").

**Suggested first-run path:** Settings (term dates + timetable shape) →
Timetable (assign cells) → Courses (build content) → Classes → assign.

## Architecture notes

- **Cycle/calendar resolution and the scheduler are pure functions** in
  `src/lib/server` (or `src/lib` if no secrets), taking plain data and returning
  plain data. They hold all the date/cycle logic and are unit-tested in
  isolation, independent of the DB and UI.
- **Drizzle schema** lives in `src/lib/server/db/schema.ts` alongside the
  existing auth tables.
- **Mutations** go through SvelteKit form actions / server endpoints that load
  the teacher from the session, call a pure function where logic is involved,
  and persist via Drizzle.
- **Views** (agenda, calendar) are server-loaded read models built by combining
  ScheduledLessons with the cycle resolver for week letters.

## Testing

- **Unit (vitest):** the cycle resolver (week-letter assignment across holidays,
  partial weeks count, empty weeks skipped) and the scheduler (append after last
  scheduled, skip closures/holidays, start next teaching day, run-out warning,
  move onto free period only). These are the highest-risk logic and must be
  thoroughly covered.
- **e2e (Playwright):** the core happy path — sign in, set term dates + timetable,
  create a course/module/lessons, create a class, assign the module, see the
  lessons on the agenda; then move and delete a scheduled lesson.

## Out of scope for v1 (explicitly deferred)

- Lesson content beyond a title (resources, objectives, notes, attachments).
- Re-sync of an edited module onto an existing schedule.
- Moving a lesson with cascade / shifting subsequent lessons.
- Clock times on periods; true time-based calendar.
- Sharing, multiple teachers per school, departments, or any collaboration.
- Importing timetables/term dates from external systems.
- Different period structures per day.
- Multiple courses per class; form groups.
```
