# Lesson pages: plan, links, and files

**Date:** 2026-06-13
**Status:** Approved (design)

## Problem

Lessons today are just a `title` and a position in a sequence. Teachers need a
real place to prepare and teach from: a written lesson plan, links to external
resources (e.g. YouTube videos), and attached files (e.g. worksheets).

This feature gives every lesson its own page with three sections:

1. An editable, WYSIWYG lesson plan (Markdown under the hood).
2. A list of attached resource links.
3. A list of attached files.

The project is deployed on **Vercel**, so file storage uses **Vercel Blob**.

## Two kinds of lesson, copy-on-schedule

The data model has two lesson entities:

- `lesson` — a reusable **template** that lives inside a _module_ of a _course_.
- `scheduled_lesson` — an **instance** placed onto a specific _class_'s timeline
  (can also be a blank spacer with no `lessonId`).

**Both** get an editable page, and they are **independent after scheduling**:

- When a module is assigned to a class, each new `scheduled_lesson` is **copied**
  from its template lesson — plan text, link rows, and file blobs are all
  duplicated at schedule time.
- After that point, edits on either side do **not** propagate. Editing the
  template never changes already-scheduled lessons; editing a scheduled lesson
  never changes the template.

This is why the content fields live on _both_ tables.

## Editor: Milkdown Crepe

The lesson plan uses **Milkdown Crepe** — a ProseMirror-based, Markdown-native
WYSIWYG editor with a batteries-included UI (slash commands, floating/bubble
toolbar on selection). It stores plain **Markdown**, keeping content portable.

Integration notes:

- Milkdown/ProseMirror need the DOM, so the editor is **mounted client-side
  only** — inside `$effect`/`onMount` with a `browser` guard. The server renders
  the saved Markdown for read view; the client mounts the editor for editing.
- Milkdown has no official Svelte wrapper; it is used via its framework-agnostic
  API mounted onto a `<div>`. Crepe provides the toolbar/UI, so we do not hand-
  build one.
- The editor bundle is **dynamically imported** on the lesson page only, so it
  never weighs down other routes.

Saving: the plan is persisted via a form action / fetch (explicit Save, or on
blur), writing the Markdown string to the `plan` column.

## Data model

Add a `plan` column (Markdown text, default empty) to **both** `lesson` and
`scheduled_lesson`.

Links and files attach to _either_ a template lesson or a scheduled lesson. We
model this with **two nullable foreign keys per table**, exactly one set per row,
both `onDelete: cascade`. This gives honest cascade deletes and a single query
path (chosen over a polymorphic `ownerType`/`ownerId`, which loses real FKs, and
over separate per-owner tables, which double the schema and code).

```
lessonLink
  id, userId
  lessonId?          -> lesson (cascade)
  scheduledLessonId? -> scheduled_lesson (cascade)   [exactly one set]
  url                 (required)
  label               (optional display text)
  orderIndex

lessonFile
  id, userId
  lessonId?          -> lesson (cascade)
  scheduledLessonId? -> scheduled_lesson (cascade)   [exactly one set]
  blobUrl             (Vercel Blob public URL)
  pathname            (blob key, needed for delete/copy)
  filename            (original name shown to the user)
  contentType
  size                (bytes)
  orderIndex
```

The "exactly one owner FK" invariant is enforced in the insert helpers (and is
covered by unit tests). `db.batch()` is used for multi-statement writes —
neon-http has no transactions.

## Routes & pages

- **Template lesson page** — `/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]`
  Reached by linking each lesson title on the module page.
- **Scheduled lesson page** — `/classes/[classId]/lessons/[scheduledLessonId]`
  Reached from the class page / timetable / agenda by linking a scheduled lesson.

Both pages share the **same three section components** and the **same
server-side query/mutation helpers**, parameterized by which owner FK they
target. The only per-page differences are the breadcrumb/back-link and the FK
column. Page structure:

1. **Plan** — Milkdown Crepe editor (client-only mount), saved as Markdown.
2. **Links** — add (url + optional label), reorder, delete. Simple clickable
   list; YouTube and other links open in a new tab. No embeds or rich previews
   in this version.
3. **Files** — upload to Vercel Blob, list with download link, delete.

Shared components:

- `LessonPlanEditor.svelte` — wraps Milkdown Crepe.
- `LessonLinks.svelte` — list + add/reorder/delete.
- `LessonFiles.svelte` — list + upload/delete.

Shared server module (e.g. `src/lib/server/queries/lesson-content.ts`) exposes
get/add/reorder/delete helpers that accept an owner discriminator
(`{ lessonId }` or `{ scheduledLessonId }`).

## File upload flow

Vercel serverless function request bodies cap at ~4.5 MB, and worksheets/PDFs
can exceed that, so files use **client-side direct upload** to Blob:

1. The browser calls a `+server.ts` token route (`@vercel/blob/client`'s
   `handleUpload`). That route checks the session, confirms the user owns the
   target lesson, and restricts allowed content types and max size before
   issuing a one-time upload token.
2. The browser uploads the file **directly to Vercel Blob**, bypassing the
   function size limit.
3. On success, the browser submits the returned blob metadata (`url`,
   `pathname`, `size`, `contentType`, `filename`) to a `?/addFile` form action,
   which verifies the blob with `head()` and inserts the `lessonFile` row.

This works both locally and in production (it does not rely on the
`onUploadCompleted` webhook, which does not fire on localhost).

Delete reverses it: `del(pathname)` then remove the row.

Defaults (easily changed):

- Max **25 MB** per file.
- Allowed: PDFs, images, Office/OpenDocument documents, plain text.

## Copy-on-schedule

The module-assign flow today copies `title` into each `scheduled_lesson`. We
extend it so each newly created scheduled lesson also receives, from its template
lesson:

- `plan` — the Markdown string, copied.
- link rows — duplicated, repointed to the new `scheduledLessonId`.
- file rows — the Vercel Blob object is **copied** (`@vercel/blob`'s `copy`) to a
  new key, with a new `lessonFile` row pointing at the copy.

Copying the blob (rather than sharing a URL) is what makes the two truly
independent. Cost is duplicated storage per scheduled lesson; worksheets are
small, so this is acceptable. Blank spacer scheduled lessons (no `lessonId`)
start empty.

## Blob adapter

All Vercel Blob calls (`put`, `copy`, `del`, `head`, `handleUpload`) are wrapped
behind a small `src/lib/server/blob.ts` module so tests mock them in one place
and the storage backend stays swappable.

## Testing

- **Unit (vitest):**
  - copy-on-schedule duplication (plan + links + file-row repointing),
  - the "exactly one owner FK" invariant,
  - link/file reorder logic.
    These are pure functions / mocked DB — no network.
- **Component (vitest-browser-svelte):** the three section components render,
  validate input, and emit the right actions; Blob/network mocked.
- **E2E (playwright):** one happy path — open a lesson page, type a plan, add a
  link, confirm they persist. File-upload e2e is optional (hits real Blob).

## Out of scope (this iteration)

- YouTube embeds and rich link previews (links stay a simple list).
- Per-class overrides that re-sync from the template (copy is one-time, then
  independent).
- Collaborative / real-time editing.
