# Planck visual reskin — design spec

**Date:** 2026-06-15
**Status:** Approved decisions; pending spec review → implementation plan.

## Goal

Apply the Claude Design handoff (`Planck.dc.html`) as a full visual reskin of the
existing SvelteKit app, keeping all current routes, server logic, forms and auth.
Re-skin **every** screen; do not change terminology ("Courses", not "Subjects").
A small set of additive backend changes were explicitly approved (see
[Backend additions](#backend-additions)) — these go beyond pure restyle because
the user opted into them.

The handoff prototype is React/JSX with in-memory state; we reproduce its **visual
output**, wiring it to the real Drizzle/Neon backend. We do **not** copy the
prototype's structure.

## Design language (from the handoff)

- **Fonts:** body = Hanken Grotesk (add `@fontsource-variable/hanken-grotesk`);
  display/headings = Fraunces (already installed).
- **Palette (rose):** primary `#D96E92`, hover `#CD5F86`, dark `#A8456A`;
  active-nav tint `#FBE7EF`, field tints `#F4EEF1` / `#FBF9FA`; page bg `#FBF8F9`;
  ink `#2B2530`; greys `#6A636F` / `#8A8290` / `#9A929E` / `#B0A8B4`; line `#F0E9ED`;
  success `#6FB287`.
- **Shape:** control radius ~12px, card radius ~18px; soft 1px shadows
  (`0 1px 2px rgba(43,37,48,0.03)`); cards `#fff` on `#FBF8F9`.

## 1. Foundations (tokens + colour)

- **Token strategy:** retune existing `@theme` token *values* in place in
  `src/routes/layout.css` (names stay: `pink`, `pink-hover`, `pink-dk`,
  `pink-50/100/200`, `ink`, `line`, `field`, `success`, radii) so all current
  components inherit the look. Add new tokens: `--color-bg` (`#FBF8F9`) and a grey
  scale (`grey-1..3`). Set `--font-sans` to Hanken Grotesk Variable.
- **Subject tinting:** courses store one arbitrary hex (`<input type="color">`).
  Add to `src/lib/colour.ts`:
  - `darken(hex, amount)` — mixes a hex toward ink `#2B2530` (returns hex);
  - `subjectTint(hex)` → `{ dot: hex, bar: hex, bg: hex@13%, soft: hex@10%, text: darken(hex) }`
    (uses existing `withAlpha`).
  This reproduces the prototype's per-subject `bg/dot/text/soft` quartets for any
  colour, with darker text guaranteeing contrast. Unit-tested in `colour.spec.ts`.
- **Two colour dimensions** (as the prototype distinguishes):
  - **Subject colour** (course): agenda badges/pills, calendar cells, course /
    module / lesson accents.
  - **Class colour** (new column, see below): sidebar "My classes", timetable
    cells, class page header.

## 2. App shell — `src/routes/(app)/+layout.svelte`

Replace the top-header + left-nav with the handoff's **256px sidebar**:

- Brand: rounded `P` tile + "Planck".
- **PLANNER** group: Agenda, Calendar, Timetable, Courses (active state =
  `#FBE7EF` bg + `#A8456A` text, bold).
- **MY CLASSES** group: colour-dot links to `/classes/[id]` (read-only); a `+`
  links to `/classes` (create/manage). **No** inline rename/recolour/delete in
  the sidebar — those live on the class pages.
- Bottom: Settings link + Log out button (`authClient.signOut()` → `/login`).
- Main area: `#FBF8F9` background, scrolls.
- **Removed:** the non-functional header search box and the header avatar
  dropdown.
- `(app)/+layout.server.ts` gains a class list query (id, name, colour) for the
  sidebar.

## 3. Shared components

**Restyle in place:** `Button`, `Card`, `Chip` (subject pill), `Field`/inputs,
`EmptyState`, `PageHeader` (gains optional pink **eyebrow** line, e.g.
"This week · Summer term"), `SubjectDot`, `ResourceLinks` / `ResourceFiles`
(icon-tile rows), `LessonPlanEditor` wrapper (card frame with
"Lesson plan · Saved automatically" header — the existing autosave/status logic
is unchanged).

**New components (focused, independently testable):** `Sidebar` (within layout),
`PeriodBadge`, `LessonCard` (agenda/class row), `Modal`, `Menu`/`Dropdown`
(postpone, timetable assign), `SegmentedControl`, `ResourceRow` (typed icon tile +
title + url/size + remove), auth `BrandPanel`.

**Resource typing (render-only, no schema change):**
- Link type from URL (`linkMeta`): youtube / google / onedrive / generic → icon +
  tile colour; title = label ?? host.
- File kind from filename/contentType (`fileMeta`): PDF / DOC / PPT / XLS / IMG /
  FILE → tile.
The "Add link" form keeps the optional label field.

## 4. Backend additions (approved scope adds)

### Schema (apply via `bun run db:push`, declining any destructive/truncate prompt; the phantom `scheduled_lesson` unique-constraint diff is expected — see memory)

| Table | Column | Type | Notes |
|---|---|---|---|
| `class` | `colour` | `text NOT NULL DEFAULT '#8775C6'` | + one-off backfill `UPDATE class SET colour = course.colour FROM course WHERE class.course_id = course.id` |
| `lesson` | `note` | `text NOT NULL DEFAULT ''` | objective |
| `scheduled_lesson` | `note` | `text NOT NULL DEFAULT ''` | objective (copied from template on assign) |
| `scheduled_lesson` | `done` | `boolean NOT NULL DEFAULT false` | agenda check |
| `scheduled_lesson` | `postponed` | `boolean NOT NULL DEFAULT false` | agenda badge |
| `module` | `description` | `text NOT NULL DEFAULT ''` | |
| `closure_day` | `name` | `text NOT NULL DEFAULT ''` | closure label |

Backfill runs as a one-off SQL statement (db:studio / neon query / tiny script),
not via push.

### Query / action changes

- **classes:** `createClass`/`updateClass` accept `colour`; `listClasses` selects
  `klass.colour`. `getClassWithCourse` returns the class colour as `colour` **and**
  keeps `courseColour` (= `course.colour`) so the class page can colour its header
  by class and its per-lesson subject pills by course. Sidebar query added to
  layout server. Note: agenda / calendar / schedule queries keep selecting
  `course.colour` (the subject dimension) — unchanged.
- **courses:** surface existing `updateCourse` (name + colour) inline on course
  detail.
- **module detail:** inline title (`renameModule`) + description (new
  `updateModuleDescription`) edit.
- **lessons:** per-lesson note (new `updateLessonNote` for template,
  `updateScheduledLessonNote` for scheduled); inline title already via
  `renameLesson` / `renameScheduledLesson`. `assignModule`/`copyLessonContent`
  copy `lesson.note` → `scheduled_lesson.note`.
- **agenda:** `toggleDone` action; group shows "x/y done"; `postpone` action that
  moves a lesson to a chosen free slot and sets `postponed = true`.
- **scheduling:** add read-only `nextFreeSlots(userId, scheduledLessonId, n)` helper
  (from `classPeriodStream` minus occupied slots) for the postpone dropdown.
  Move still goes through validated `moveScheduledLesson`. Spec-tested.
- **settings:** relax `saveConfig` teaching-days filter to `1..7`;
  `addClosure` accepts `name`; Account card uses better-auth client
  (`changePassword` current+new, `changeEmail` best-effort).

## 5. Screen-by-screen

- **Auth** (`/login`, `/signup`): split brand-panel (left) + form (right); tabs
  are links between the two routes. Email/password as today; **"Keep me signed in"**
  passes `rememberMe`. **Omit** forgot-password and Google/Microsoft (follow-ups,
  not dead UI).
- **Agenda:** grouped day cards with `PeriodBadge` (subject colour), subject pill,
  room, **Done** checkbox (strikethrough + "x/y done"), **Postpone** clock-icon
  dropdown listing next free slots, **Postponed** amber badge; eyebrow = current
  term (from teaching block containing today). (The prototype's "Upcoming/All"
  segmented control is **omitted** — backend returns upcoming only.)
- **Calendar:** existing week grid (`?start=` nav, week letter), subject-coloured
  cells; add today-column highlight + Sat/Sun support.
- **Timetable:** popup-menu cell editor (class list + room field + "Clear slot"),
  cells tinted by **class** colour, week A/B toggle, class legend.
- **Courses list:** card rows + restyled create (name + colour).
- **Course detail:** inline swatch + name (course); modules list with **DnD +
  ↑/↓** reorder; resources aside (Web links / Files).
- **Module detail:** breadcrumb; inline title + description; lesson sequence with
  **DnD + ↑/↓**, inline lesson title + objective, **attachment count** per lesson;
  **Assign to classes** multi-select modal (loops `assignModule`); resources aside.
- **Lesson** (template & scheduled): inline title + objective + subject pill +
  position; editor card; **responsive two-column** (editor + resources aside,
  stacks on narrow) — **no** layout toggle; typed resource rows.
- **Settings:** Account card (email/password via better-auth); Timetable (cycle,
  **Mon–Sun** teaching days, periods-per-day **count** stepper, anchor week);
  Terms (teaching blocks); Closures (**name** + date); Log out.
- **Classes list:** card rows + create (name + course + colour).
- **Class detail:** inline swatch + name (class); existing rich sequence (DnD
  reorder, inline rename, insert-blank, overflow) restyled; per-row subject pill.

## 6. Testing

- Keep existing vitest browser component tests green (`Button`, `Card`-consumers,
  `ResourceLinks`, `ResourceFiles`, `LessonPlanEditor`), updating markup
  expectations where restyled.
- New unit tests: `colour.spec.ts` (`darken`, `subjectTint`), `nextFreeSlots`
  spec, weekend teaching-days spec.
- Run `bun run check`, `bun run lint`, `bun run test:unit` before completion.

## Out of scope (follow-ups)

Forgot-password flow; Google/Microsoft OAuth; named periods (period table +
scheduler rework); agenda "All" filter; lesson layout toggle; inline sidebar class
editing; full inline per-lesson attachment chips/add on the module list; postpone
to non-timetabled days.

## Migration / ops notes

- Driver is `neon-http` — **no transactions**; use `db.batch()` (already the
  pattern). New columns all have defaults, so adds are non-destructive.
- `db:push` never reports "No changes" and always shows a phantom
  `scheduled_lesson` unique-constraint diff; **do not** accept its truncate
  prompt.
