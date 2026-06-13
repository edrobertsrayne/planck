# Class page with an editable lesson sequence

**Date:** 2026-06-13
**Status:** Approved (design)

## Problem

Teachers need to adjust their plans for a class in response to real-world
changes — a day when many students will be absent, or a resource that is
unavailable. Today, lessons are scheduled by assigning a module to a class,
which freezes each lesson onto a concrete timetable slot. There is no per-class
view for reshaping that plan, and no way to reorder, insert a gap, delete, or
rename individual lessons.

This feature adds a per-class page reachable from the Agenda, Calendar, and
Classes pages. The page shows the class's upcoming lessons as an ordered,
editable sequence supporting drag-and-drop reorder, insert-a-blank (push the
rest forward), delete (pull the rest back), and inline rename.

## Core model: sequence is the source of truth, slots are derived

Today a `scheduled_lesson` row stores a concrete `date` + `period`, baked in at
assignment time. The slot stream (`classPeriodStream`) is computed transiently
during assignment and then discarded. There is nowhere to hold "a lesson with
no slot yet", so overflow cannot be represented.

We invert this: **the ordered sequence of lessons per class is the source of
truth; slot allocation is derived.** Each class owns an ordered list of lesson
items (`orderIndex`). A single allocation pass walks the class's future
timetabled-slot stream and stamps `date`/`period`/`room` onto as many items as
fit. Items beyond the last available slot get no date (the overflow tail).

Consequences:

- Reorder / insert / delete are simple sequence edits followed by reallocation.
- Overflow is **self-healing**: when future slots appear (a new teaching block /
  term) or items are removed, the next allocation flows the tail back in.
- Renames persist independently of allocation, because allocation never touches
  the title.

## Scope decisions (from brainstorming)

- **Reorder/insert/delete operate on fixed slots** — dates/periods are fixed
  containers; lesson content flows across them. Slots themselves never move.
- **Rename changes only this scheduled instance** (`scheduled_lesson.title`),
  not the module's lesson template.
- **Blank lessons** are represented by nullable `lessonId`/`moduleId` — a
  free-standing placeholder with just a title.
- **Overflow** is allowed and self-healing (nullable `date`/`period`), shown as
  a greyed tail with a warning. No data is lost.
- **Past lessons are hidden** on the class page (scope is upcoming plans) and
  are frozen — never reallocated.

## Schema changes

`scheduled_lesson`:

- Add `orderIndex integer NOT NULL` — sequence position within the class.
- `date`, `period` become **nullable** (`null` = overflow / not yet allocated).
- `lessonId`, `moduleId` become **nullable** (`null` = blank inserted spacer).
- Add unique constraint `(userId, classId, orderIndex)`.
- Keep existing unique `(userId, classId, date, period)` — Postgres permits
  multiple `NULL`s, so overflow rows do not collide.

**Migration:** backfill `orderIndex` per class by ordering existing rows on
`(date, period)`, then apply the nullability and constraint changes.

## Allocation — `reallocateClass(userId, classId, today)`

The single place that maps sequence → slots. Lives in
`src/lib/server/queries/schedule.ts`.

1. Load the class's rows ordered by `orderIndex`.
2. **Freeze** rows with `date < today` (already taught) — never touched.
3. Build the future slot stream via the existing `classPeriodStream(...)`,
   filtered to `date >= today`.
4. Walk the remaining ("flow") rows in `orderIndex` order, stamping each with
   the next stream slot's `date`/`period`/`room`. Rows past the end of the
   stream get `date = period = null` (overflow).
5. Persist only changed rows in a transaction.

Allocation **never touches** `title`, `lessonId`, `moduleId`, or `orderIndex`,
so renames and ordering survive reallocation, and a lesson's room re-derives
from whatever slot it lands on.

Invariant: the frozen past is always a prefix (lowest `orderIndex`) because
assignment appends chronologically and sequence edits only renumber flow items,
keeping them after the frozen prefix's maximum `orderIndex`.

Boundary detail: a flow item may be assigned to a slot earlier _today_ that has
already passed; we ignore intra-day time and treat `today` as the boundary.

## Server actions & helpers

New helpers in `queries/schedule.ts`, each ending with `reallocateClass`:

- `reorderSequence(userId, classId, orderedIds[])` — renumber visible (flow)
  items after the frozen prefix. Mirrors the existing `reorderLessons`.
- `insertBlank(userId, classId, atIndex, title)` — insert a `lessonId=null`
  row, renumber, reallocate (everything after shifts one slot later).
- `deleteFromSequence(userId, id)` — delete, renumber, reallocate (tail pulls
  back one slot).
- `renameScheduledLesson(userId, id, title)` — set `scheduled_lesson.title`
  only (this instance).

Existing flows updated to the sequence model:

- `assignModule` — append lessons as sequence items (`orderIndex` after the
  current max) then `reallocateClass`, instead of computing placements inline.
- `unscheduleModule` — delete the module's items, renumber, reallocate.

Timetable hooks — the settings actions that mutate timetable inputs call
`reallocateClass` for affected classes afterward, so allocations stay correct
everywhere:

- `upsertConfig`, `addBlock`, `deleteBlock`, `addClosure`, `deleteClosure`
  (affect all of the user's classes),
- `setSlot`, `clearSlot` (affect the slot's class).

Agenda reconciliation: the Agenda page's existing per-lesson delete routes
through `deleteFromSequence`. The Agenda per-lesson "move" remains an explicit
one-off override of a single placement (it sets a concrete date/period and is
not re-derived); this is acknowledged as a deliberate manual override.

## Route & page load

New route `src/routes/(app)/classes/[classId]/`.

`+page.server.ts` `load` returns:

- the class (name, course, colour),
- **upcoming** items (`date >= today`): `id`, `orderIndex`, `date`, `period`,
  `room`, `title`, derived week-letter,
- the **overflow** tail (`date is null`): `id`, `orderIndex`, `title`,

all ordered by `orderIndex`. Past lessons (`date < today`) are excluded.

`actions`: `reorder`, `insertBlank`, `delete`, `rename`.

## Navigation

Class names link to `/classes/{id}` from:

- **Classes** page — wrap `c.name` in an `<a>` (already has `c.id`).
- **Agenda** — add `classId` to the load query select; link `item.className`.
- **Calendar** — add `classId` to the load select; link `l.className`.

## Frontend — class page UI

Agenda-style vertical list reusing the existing card styling, but a flat ordered
list (not grouped by day), since order is what is being edited. Each row:

- drag handle, sequence number, date + period + week-letter, `SubjectDot`,
  inline-editable title, room badge, delete button.
- "Insert blank above" affordance between rows; "add blank at end" button.
- Overflow rows render greyed at the bottom under a "No timetabled slot yet"
  warning.

**Drag-and-drop:** add `svelte-dnd-action` (Svelte-5/runes compatible; handles
touch, keyboard accessibility, and drop animation). On drop, persist via the
existing pattern — submit the new `orderedIds` to the `?/reorder` form action
with `use:enhance`. Up/down arrow buttons remain as a no-JS/accessible fallback,
consistent with the modules page.

All Svelte components are validated with the `svelte-autofixer` MCP tool before
completion.

## Testing

- `reallocateClass` unit tests: chronological fill; frozen past untouched;
  overflow tail when slots run out; self-heal when slots are added; inserting a
  blank shifts the tail forward by one slot.
- Sequence-op unit tests: reorder/insert/delete renumbering; frozen-prefix
  invariant preserved.
- Follow the existing `.spec.ts` style in `lib/scheduling` and the queries.

## Out of scope

- Editing past (already taught) lessons.
- Changing the Agenda per-lesson "move" override behaviour beyond routing delete
  through the sequence helper.
- Bulk multi-lesson drag selection.
