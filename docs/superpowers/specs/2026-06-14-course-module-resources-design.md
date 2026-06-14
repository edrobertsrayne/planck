# Course & Module Resources — Design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)

## Summary

Teachers can already attach links and files to lessons (both template lessons and
scheduled lessons). This adds the same capability to **courses** and **modules**.
Courses and modules get links and files but **no free-text plan editor** — only
lessons have a plan.

The work generalises the existing lesson-resource machinery from two owner types
(`lesson`, `scheduled`) to four (`lesson`, `scheduled`, `course`, `module`), and
renames the now-misnamed "lesson content" code to a generic "resource" vocabulary.

## Goals

- Attach/remove **links** and **files** on the course page and the module page.
- Resources render as two cards ("Links", then "Files") below the existing list
  on each page, mirroring the lesson page.
- Reuse the existing storage, upload, ownership, and validation machinery — no new
  patterns.

## Non-goals

- No plan / free-text editor on courses or modules.
- No reordering UI for resources (lessons don't have one either; the existing
  `reorderLinks` query stays unused by these pages).
- No change to how lessons or scheduled lessons behave.
- Not fixing the pre-existing orphan-blob behaviour (see Known Limitations).

## Current architecture (what we're extending)

- **Tables** `lesson_link` / `lesson_file` each carry nullable FK columns
  `lesson_id` and `scheduled_lesson_id`; exactly one is set per row (app-enforced),
  both `onDelete: 'cascade'`.
- **`OwnerRef`** (`src/lib/lesson-content/owner.ts`) is a discriminated union
  `{ lessonId } | { scheduledLessonId }`. `ownerColumns()` maps it to the column
  pair and throws unless exactly one side is set.
- **Queries** (`src/lib/server/queries/lesson-content.ts`) — `saveLessonPlan`,
  plus generic `listLinks/addLink/deleteLink/reorderLinks` and
  `listFiles/addFile/deleteFile` that branch on the owner.
- **Upload route** `/api/lesson-files/upload` validates ownership via
  `userOwnsTarget(userId, ownerType, ownerId)` for `'lesson'` / `'scheduled'`,
  then issues a Vercel Blob client-upload token.
- **Components** `LessonLinks.svelte` (links list + add/delete forms) and
  `LessonFiles.svelte` (files list + client-side upload; takes `ownerType` +
  `ownerId`).
- **Copy** (`src/lib/lesson-content/copy.ts`) duplicates a template lesson's
  links/files onto a scheduled lesson when a module is assigned.

Live data exists (10 courses, 10 modules, 14 lessons, 4 links, 2 files, 5
scheduled lessons), so schema changes must be non-destructive.

## Design

### 1. Data model

Both tables are **physically renamed** and gain two nullable FK columns:

- `lesson_link` → `resource_link`
- `lesson_file` → `resource_file`
- New columns on each: `course_id integer references course(id) on delete cascade`,
  `module_id integer references module(id) on delete cascade`.

Drizzle symbols rename to match: `resourceLink`, `resourceFile`.

The owner invariant becomes **exactly one of four** columns set
(`lesson_id` / `scheduled_lesson_id` / `course_id` / `module_id`). Deleting a
course or module cascades its resource rows directly; deleting a course also
cascades modules → lessons → their resource rows as today.

`OwnerRef` grows to four variants:

```ts
type OwnerRef =
  | { lessonId: number }
  | { scheduledLessonId: number }
  | { courseId: number }
  | { moduleId: number };

interface OwnerColumns {
  lessonId: number | null;
  scheduledLessonId: number | null;
  courseId: number | null;
  moduleId: number | null;
}
```

`ownerColumns()` resolves whichever single key is present and throws unless
exactly one of the four is non-null.

### 2. Migration

The project syncs schema with `drizzle-kit push` and keeps no migration files;
the `neon-http` driver has **no transactions** (see project memory), so the rename
is applied as a **hand-written idempotent SQL script** run once against Neon:

```sql
-- 1. Rename the tables (rows preserved).
ALTER TABLE IF EXISTS lesson_link RENAME TO resource_link;
ALTER TABLE IF EXISTS lesson_file RENAME TO resource_file;

-- 2. Rename the pre-existing FK constraints to the new table prefix, so push
--    sees Drizzle-convention names and reports clean. (Constraint names do NOT
--    auto-update on table rename.) Per table:
--    <old>_lesson_id_lesson_id_fk            → resource_*_lesson_id_lesson_id_fk
--    <old>_scheduled_lesson_id_..._fk        → resource_*_scheduled_lesson_id_..._fk
ALTER TABLE resource_link
  RENAME CONSTRAINT lesson_link_lesson_id_lesson_id_fk
  TO resource_link_lesson_id_lesson_id_fk;
-- …equivalent RENAME CONSTRAINT for the scheduled_lesson FK and for resource_file.

-- 3. Add the new owner columns (nullable) and their FKs with convention names.
ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS course_id integer;
ALTER TABLE resource_link ADD COLUMN IF NOT EXISTS module_id integer;
ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS course_id integer;
ALTER TABLE resource_file ADD COLUMN IF NOT EXISTS module_id integer;
-- ADD CONSTRAINT resource_link_course_id_course_id_fk
--   FOREIGN KEY (course_id) REFERENCES course(id) ON DELETE CASCADE;  (+ module_id,
--   and both for resource_file) — guarded with IF NOT EXISTS via a DO block or by
--   checking pg_constraint first so re-running is safe.
```

The exact pre-existing constraint names are confirmed against `pg_constraint`
before writing the script (Drizzle's default is
`<table>_<col>_<reftable>_<refcol>_fk`). Statements are guarded so re-running is
safe. After running it, `schema.ts` is updated to match and `bun run db:push` is
run; it must report **no changes** — the verification that `schema.ts` and the
live DB agree, including FK constraint names. Any residual cosmetic diff Drizzle
doesn't track (e.g. the `*_pkey` or `*_id_seq` names left from the rename) is
harmless and noted if it appears.

### 3. Code structure

- **Lib dir** `src/lib/lesson-content/` → `src/lib/resources/`
  (`owner.ts`, `files.ts`, `copy.ts`, and their `.spec.ts`).
  - `copy.ts` stays 2-owner-shaped — it only ever copies a template lesson's
    resources onto a scheduled lesson. The unspecified `course_id`/`module_id`
    columns default to null on insert. No behavioural change.
- **Query layer** splits by responsibility:
  - New `src/lib/server/queries/resources.ts` — the generic links/files CRUD
    (`listLinks`, `addLink`, `deleteLink`, `reorderLinks`, `listFiles`, `addFile`,
    `deleteFile`), with the owner-branch helpers extended to four variants.
  - Slim `src/lib/server/queries/lesson-content.ts` — keeps only
    `saveLessonPlan` (lesson/scheduled-only).
- **`schedule.ts`** updates to the renamed symbols (`resourceLink`,
  `resourceFile`) and the new `$lib/resources/copy` import path.

### 4. Upload route

`/api/lesson-files/upload` → `/api/resource-files/upload`.

`userOwnsTarget` learns two more owner types:

- `'course'` — row exists in `course` for `(id, userId)`.
- `'module'` — row exists in `module` for `(id, userId)`.

The ownership-failure error message is generalised (e.g. "Not your resource").
The blob storage path prefix (`lesson-files/…`) is **unchanged** — renaming it
would orphan existing blobs for no user benefit.

### 5. Components

- `LessonLinks.svelte` → `ResourceLinks.svelte`; `LessonFiles.svelte` →
  `ResourceFiles.svelte` (and their tests).
- `ResourceFiles` `ownerType` prop widens to
  `'lesson' | 'scheduled' | 'course' | 'module'`; it posts to the renamed upload
  route and records the row via the relative `?/addFile` form action.
- `ResourceLinks` is unchanged apart from its name — it already posts to the
  relative `?/addLink` / `?/deleteLink` actions, so it works on any page that
  defines those actions.
- Lesson and scheduled-lesson pages get import/prop renames only; behaviour is
  identical.

### 6. Pages

**Course page** (`/courses/[courseId]`):

- Loader additionally returns `links: listLinks(userId, { courseId })` and
  `files: listFiles(userId, { courseId })`.
- Actions gain `addLink`, `deleteLink`, `addFile`, `deleteFile` (scoped to
  `{ courseId }`). No `savePlan`.
- Renders, below the modules list and the "Add module" card:
  a **Links** card (`ResourceLinks`) then a **Files** card
  (`ResourceFiles ownerType="course" ownerId={course.id}`).

**Module page** (`/courses/[courseId]/modules/[moduleId]`):

- Loader additionally returns `links`/`files` for `{ moduleId }`.
- Actions gain `addLink`, `deleteLink`, `addFile`, `deleteFile` (scoped to
  `{ moduleId }`).
- Page is reordered so the most-likely action is first. Final stacking:
  1. Back-link + page header
  2. **Schedule this module** card (moved to the top)
  3. Lessons list (or empty state)
  4. **Add lesson** card
  5. **Links** card
  6. **Files** card (`ownerType="module" ownerId={module.id}`)

### 7. Testing

- Extend `owner.spec.ts` (now under `src/lib/resources/`) to cover the
  `courseId` and `moduleId` variants and the four-way "exactly one" rule
  (throws when none and when more than one are set).
- Update the renamed `ResourceLinks` / `ResourceFiles` component tests, including
  rendering with `ownerType` `'course'` and `'module'`.
- No e2e changes — resources have no e2e coverage today (the happy-path flow test
  doesn't touch them, and file upload isn't e2e-able without a real blob token).

## Known limitations (pre-existing, out of scope)

Cascade deletes (deleting a course, module, or lesson) remove `resource_file`
*rows* but do not delete the underlying blobs — identical to how deleting a lesson
already behaves. Explicit per-row deletion (`deleteFile`) still removes the blob.
Recorded here for awareness; not addressed by this work.

## Files touched (overview)

- `src/lib/server/db/schema.ts` — rename tables, add columns.
- Migration SQL (run once) + `db:push` verification.
- `src/lib/resources/{owner,files,copy}.ts` (+ specs) — moved from `lesson-content/`.
- `src/lib/server/queries/resources.ts` (new) + `lesson-content.ts` (slimmed).
- `src/lib/server/queries/schedule.ts` — renamed symbols/imports.
- `src/routes/api/resource-files/upload/+server.ts` — renamed route, +course/module.
- `src/lib/components/Resource{Links,Files}.svelte` (+ tests) — renamed.
- Course `+page.server.ts` / `+page.svelte`, Module `+page.server.ts` /
  `+page.svelte` — loaders, actions, resource cards, module reorder.
- Lesson `+page.{server.ts,svelte}` and scheduled-lesson `+page.{server.ts,svelte}`
  — import/prop renames only.
