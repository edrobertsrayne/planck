# Reference-counted blobs + scheduled-lesson lifecycle

**Issue:** #1 — Cascade deletes orphan resource blobs in Vercel Blob storage
**Date:** 2026-06-18
**Branch:** `feat/reclaim-orphaned-blobs`

## Problem

`resource_file` rows each carry a `blobUrl` + `pathname` pointing at a Vercel
Blob. The only path that deletes a blob today is the explicit per-row
`deleteFile()`. Every _cascade_ path leaks: deleting a course/module/lesson/class
removes the `resource_file` rows via Postgres FK cascade, but the backing blobs
are never deleted and accumulate forever.

Two structural facts shape the fix:

- Scheduling a lesson onto a class today **physically copies** each blob to a
  fresh pathname (`copyLessonContent`, schedule.ts), so every scheduled lesson
  owns an independent duplicate that nothing ever reclaims.
- `scheduled_lesson` ties its lifecycle to the _content_ side via cascading FKs
  (`lesson_id`, `module_id`), so deleting a module or template lesson deletes the
  scheduled lessons (and history) made from it.

`neon-http` has **no transactions** (project memory), so multi-step deletes must
be ordered for safety, not atomicity.

## Goals

1. A blob is deleted exactly when the **last** `resource_file` reference to its
   pathname is removed — by any delete path. Closes issue #1.
2. Scheduling shares one blob across rows (reference, not copy), so storage does
   not balloon and reference-counting is meaningful.
3. Deleting _content_ (a module/topic or a template lesson) does **not** affect
   scheduled lessons — they are independent records of what was taught.
4. Old scheduled lessons are purged on an academic-year rollover (keep current +
   previous year), so history is retained for review but not forever.
5. Destructive deletes that remove scheduled-lesson history are confirmed first.

## Decisions (from brainstorming)

- **Blob model:** **shared reference, reference-counted.** `copyLessonContent`
  copies `blobUrl`/`pathname` into the new row without duplicating the blob.
  `copyBlob` (used only there) is removed. A blob is deleted only when no
  `resource_file` row references its pathname. Safe because Vercel blobs are
  immutable — only deletion mutates shared state, and the count guards it.
- **Content/schedule decoupling:** flip `scheduled_lesson.lesson_id` **and**
  `module_id` from `cascade` to `set null` (both already nullable). Deleting a
  module/topic or template lesson detaches scheduled lessons (they keep their
  copied title/plan/note/resources). `class_id` stays NOT NULL + cascade — a
  scheduled lesson can't outlive its class, so deleting a **class** (or a
  **subject**, which cascades to its classes) does remove the schedule/history.
- **Surface:** all cascade roots — `deleteCourse`, `deleteModule`,
  `deleteLesson`, `deleteClass`, `unscheduleModule`, scheduled-lesson deletion.
- **Retention:** configurable academic-year start (`timetable_config`, default
  1 Sept). Keep the current + previous academic year; purge scheduled lessons
  dated before the previous year's start. Per-user (each teacher's boundary).
- **Cron:** daily at **03:00 UTC** via Vercel Cron; purges anything past each
  user's retention boundary (the "rollover" happens naturally as the boundary
  advances).
- **Confirmation dialogs:** guard subject, class, and module deletion. Single
  scheduled-lesson delete and template-lesson delete stay unguarded.

## Architecture

Layer 0 changes how blobs are shared; Layer 1 reclaims them on delete (closes
#1); Layer 2 is the academic-year reaper; Layer 3 adds confirmation dialogs.

### Layer 0 — share blobs instead of copying

- **`copyLessonContent`** (queries/schedule.ts): drop the `copyBlob` call; insert
  the copied `resource_file` rows reusing the template's `blobUrl`/`pathname`.
- **`src/lib/resources/copy.ts`**: `buildCopiedFileRows` drops its `copies`
  argument and carries each file's own `blobUrl`/`pathname` through. Update
  `copy.spec.ts`.
- **`src/lib/server/blob.ts`**: remove `copyBlob` and the now-unused `copy`
  import. Add `deleteBlobs(pathnames: string[])` (chunked `del()`).
- Forward-only: existing physically-duplicated blobs stay (each referenced once)
  and are reclaimed normally when their row is deleted/reaped.

### Layer 1 — reference-counted blob reclamation on delete

- **`src/lib/resources/reclaim.ts`** (new, pure):
  `pathnamesToReclaim(candidates, stillReferenced): string[]` — de-duplicated set
  difference. Unit-tested (`copy.spec.ts` style).
- **`src/lib/server/queries/resource-cleanup.ts`** (new):
  - `descendantFilePathnames(root)` — pathnames of every `resource_file` row the
    cascade will remove, one query per root (subqueries mirror the FK graph).
    With `module_id`/`lesson_id` set-null, the roots simplify to:
    - `{ lesson: id }` → `lesson_id = id`.
    - `{ module: id }` → `module_id = id` ∪ lessons-of-module's `lesson_id`.
    - `{ course: id }` → `course_id = id` ∪ its modules' `module_id` ∪ those
      lessons' `lesson_id` ∪ scheduled lessons of the course's classes
      (`scheduled_lesson_id` where `class_id ∈ course's classes`).
    - `{ class: id }` → scheduled lessons with `class_id = id`.
    - `{ scheduledLessonIds }` → `scheduled_lesson_id IN (...)`.
  - `reclaimBlobs(candidatePathnames)` — after rows are gone, re-query which
    candidates still appear in `resource_file`, then
    `deleteBlobs(pathnamesToReclaim(candidates, stillReferenced))`. **Load-bearing
    now:** e.g. deleting a template lesson leaves its scheduled copies' rows
    referencing the shared blob, so the blob survives. Errors logged, not
    rethrown.
  - `deleteAndReclaim(root, deleteRows)` — gather → `await deleteRows()` →
    `reclaimBlobs()`. Ordering: worst case is a leaked blob, never a row pointing
    at a deleted blob.
- **Wiring:** `deleteCourse`/`deleteModule`/`deleteLesson` (courses.ts),
  `deleteClass` (classes.ts), `unscheduleModule` + `deleteFromSequence`
  (schedule.ts) route through `deleteAndReclaim`. `deleteFile` (resources.ts)
  switches to `reclaimBlobs([pathname])`.

### Layer 2 — academic-year scheduled-lesson reaper

- **`timetable_config`** gains `academic_year_start_month` (int, default 9) and
  `academic_year_start_day` (int, default 1).
- **`academicYearCutoff(today, startMonth, startDay)`** (pure, in
  `src/lib/scheduling/dates`): returns the previous academic year's start date
  (the most recent year-start on/before today, minus one year). Lessons dated
  before this are purged.
- **`reapScheduledLessonsBefore(userId, cutoff)`** (queries/schedule.ts):
  collect scheduled-lesson ids for that user with `date IS NOT NULL AND
date < cutoff`, then `deleteAndReclaim({ scheduledLessonIds }, …)`.
- **`src/routes/api/cron/reap-scheduled-lessons/+server.ts`** — `GET` guarded by
  pure `isAuthorizedCron(header, secret)` (`Authorization: Bearer ${CRON_SECRET}`).
  Iterates users that have scheduled lessons, looks up each one's config (falling
  back to 9/1), computes their cutoff, reaps, and returns total `{ reaped }`.
  Resilient: one failure does not abort the run.
- **`vercel.json`** — add `crons`: `/api/cron/reap-scheduled-lessons`, `0 3 * * *`.
- **`.env.example`** — add `CRON_SECRET`.

### Layer 3 — confirmation dialogs for destructive cascades

Guard subject (course), class, and module deletion — each removes scheduled-lesson
history. Single scheduled-lesson delete and template-lesson delete stay one-click.

- **Reuse `src/lib/components/Modal.svelte`**; add a `ConfirmDelete.svelte`
  wrapper (title, blast-radius message, Cancel + Delete). Delete submits the
  existing `?/delete` form unchanged.
- **Blast-radius counts** via impact queries, fetched lazily when the dialog
  opens (keeps list-page loads cheap):
  - `courseDeletionImpact(userId, id)` → `{ classes, scheduledLessons, files }`
  - `classDeletionImpact(userId, id)` → `{ scheduledLessons, files }`
  - `moduleDeletionImpact(userId, id)` → `{ lessons, files }` (modules no longer
    cascade scheduled lessons)
    Rendered e.g. "This deletes this subject, its 3 classes, 41 scheduled lessons
    and 12 files. This cannot be undone." Display-only; deletion is still the
    cascade.

## Data flow (course delete)

1. `descendantFilePathnames({ course: id })` collects template files (course /
   module / lesson) and scheduled-lesson files (via the course's classes).
2. `db.delete(course)` — Postgres cascades modules → lessons, classes →
   scheduled lessons, and the `resource_file` / `resource_link` rows; detaches
   nothing here because everything under the course is removed.
3. `reclaimBlobs(pathnames)` deletes the blobs whose pathname no longer appears
   in any `resource_file` row.

## Error handling

No transactions: steps ordered, not atomic. `del()` is idempotent on missing
blobs. Reclaim failures are logged, never surfaced as form-action errors. The
reaper continues past per-user/per-blob failures. Large runs bounded by chunked
`deleteBlobs`.

## Schema changes + migration

In `schema.ts`, then one `bun run db:generate` + committed migration:

1. `scheduledLesson.lessonId` → `onDelete: 'set null'`.
2. `scheduledLesson.moduleId` → `onDelete: 'set null'`.
3. `timetableConfig`: add `academicYearStartMonth` (int, default 9) and
   `academicYearStartDay` (int, default 1).

No data backfill — existing rows keep their values; the FK change only alters
delete behaviour going forward.

## Testing

Pure logic unit-tested; DB-backed behaviour proven end-to-end against the forked
Neon `test` branch (`bun run db:test:setup` → `e2e/*.e2e.ts`), which hits real
Vercel Blob so storage side-effects are observable.

- **Unit (vitest):** `pathnamesToReclaim`; `isAuthorizedCron`;
  `academicYearCutoff` (year boundaries, before/after the start date, leap-year
  sanity); `buildCopiedFileRows` (now reuses the source pathname).
- **e2e — issue #1 core:** upload to a lesson and a course/module, capture the
  blob URL, delete the parent, assert the URL returns HTTP 404. Cover a per-row
  `deleteFile` case and a cascade root reaching scheduled-lesson rows.
- **e2e — reference counting:** schedule a lesson (now sharing the blob), delete
  the _template lesson_; assert the scheduled lesson, its `lesson_id = null`, and
  the **shared blob still exist**. Then delete the scheduled lesson; assert the
  blob is now 404 (last reference gone).
- **e2e — module decouple:** delete a module; assert scheduled lessons made from
  it survive with `module_id = null`.
- **e2e — reaper:** with a configured year start, age a scheduled lesson before
  the previous-year boundary, call the cron endpoint with the `CRON_SECRET`
  bearer, assert the lesson and (if last reference) its blob are gone, and that a
  lesson inside the retained window is untouched. Date-ageing mechanism finalized
  in the plan.
- **e2e — confirmation dialogs:** subject/class/module delete opens the dialog
  with non-zero counts; Cancel aborts; Delete cascades. Single scheduled-lesson
  delete still one-click.

## Refinements from design review

- **Blob-reclaim race (accepted):** with shared pathnames and no transactions, a
  concurrent `assignModule` could re-reference pathname `P` while `P`'s owner is
  being deleted, and `reclaimBlobs` could `del()` a now-referenced blob → one
  dangling row. Window is tiny (single-teacher tool; delete + schedule of the
  same lesson concurrently). Mitigated by re-querying references _after_ the row
  delete; otherwise accepted and documented. Self-corrects on the next reclaim of
  that row.
- **Set-null join-safety (verified):** no query inner-joins `scheduled_lesson` to
  `lesson`/`module`; `getScheduledLesson` joins only via `class_id`;
  `listUpcoming` has no consumers. Detached rows (null `lesson_id`/`module_id`)
  need no consumer changes.
- **Reaper does not reallocate:** it only deletes rows in the frozen past prefix
  (before the previous academic year), which is outside the editable sequence
  (overflow + on/after today). `orderIndex` gaps are harmless. (Manual
  `deleteFromSequence` still reallocates — it can delete future rows.)
- **Cron fails closed:** `isAuthorizedCron` returns false when `CRON_SECRET` is
  unset (503, no purge) or the bearer mismatches (401). Required in prod; e2e
  supplies it via `.env.test`. Constant-time-ish compare.
- **Reaper per-run cap:** delete at most N (≈500) oldest scheduled lessons per
  invocation; the daily schedule drains any first-run backlog over days. Chunk
  `deleteBlobs` and the reference-check `inArray` as well.
- **Year-start UI:** `/settings` gains a month dropdown + day input (default
  9/1); server validates month 1–12 and day within that month, via
  `getConfig`/`upsertConfig` + `DEFAULT_CONFIG`.
- **Impact counts:** one shared session-scoped `GET /api/deletion-impact?type=&id=`
  endpoint, fetched lazily when the dialog opens.

## Phasing (three plans / PRs)

- **Phase A — closes issue #1:** Layer 0 (blob sharing, remove `copyBlob`) +
  Layer 1 (reference-counted reclamation on all delete paths) + the two FK
  `set null` changes + their migration.
- **Phase B:** Layer 2 — reaper, `timetable_config` columns + `/settings` UI +
  migration, cron endpoint, `vercel.json`.
- **Phase C:** Layer 3 — confirmation dialogs + `/api/deletion-impact`.

Phases B and C are independent of each other; both depend on Phase A.

## Out of scope

- A historical sweep of blobs already orphaned by past deletes (synchronous
  strategy chosen over reconciliation).
- **Abandoned-upload orphans** (blob created, `addFile` never completes) — a
  distinct orphan source reference-counting can't catch. Tracked in **#21**.
- Time-reaping templates (courses/modules/lessons) — only scheduled lessons are
  reaped.
- Retroactively de-duplicating the physically-copied blobs created before Layer 0.
