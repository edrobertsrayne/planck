# Planck Reskin — Plan 3: Screen Reskins & Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every screen's markup to match the handoff, wiring it to the Plan 1 components and Plan 2 backend, with tablet-down responsive behaviour.

**Architecture:** Each route's `+page.svelte` is rebuilt; `+page.server.ts` load/actions stay as-is except where Plan 2 already changed them. Reuse Plan 1 components (PageHeader, Card, Button, Field, SegmentedControl, Modal, Menu, PeriodBadge, ResourceLinks/Files, BrandPanel). Use `subjectTint()` for all colour tints.

**Tech Stack:** Svelte 5 runes, SvelteKit form actions (`use:enhance`), Tailwind v4, `svelte-dnd-action`, Milkdown (`LessonPlanEditor`), better-auth client.

**Prereqs:** Plan 1 and Plan 2 complete and merged into this branch.

**Reference:** `docs/design-reference/Planck.dc.html` — cited line ranges below give exact static markup (paddings, font sizes, SVG paths). Reproduce those visuals; wire interactivity as specified here.

**Conventions**

- After each task: `bun run check` PASS; visually verify the page at ~1280/1024/768px via `bun run dev`.
- Hover-only actions must also show on `focus-within` and on touch — gate the hide with `@media (hover: hover)` (Tailwind: keep controls visible, add `[@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`).
- Run `mcp__svelte__svelte-autofixer` on each new/edited `.svelte` file until clean before committing.
- Commit after each task.

---

## File structure (all MODIFY unless noted)

| Route file                                                                               | Screen                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/routes/login/+page.svelte`, `src/routes/signup/+page.svelte`                        | Auth                                                                                                            |
| `src/routes/(app)/agenda/+page.svelte`                                                   | Agenda                                                                                                          |
| `src/routes/(app)/calendar/+page.svelte`                                                 | Calendar                                                                                                        |
| `src/routes/(app)/timetable/+page.svelte`                                                | Timetable                                                                                                       |
| `src/routes/(app)/courses/+page.svelte`                                                  | Courses list                                                                                                    |
| `src/routes/(app)/courses/[courseId]/+page.svelte`                                       | Course detail                                                                                                   |
| `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`                    | Module detail                                                                                                   |
| `src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.svelte` | Lesson (template)                                                                                               |
| `src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.svelte`            | Lesson (scheduled)                                                                                              |
| `src/routes/(app)/settings/+page.svelte`                                                 | Settings                                                                                                        |
| `src/routes/(app)/classes/+page.svelte`                                                  | Classes list                                                                                                    |
| `src/routes/(app)/classes/[classId]/+page.svelte`                                        | Class detail                                                                                                    |
| `src/routes/(app)/courses/[courseId]/+page.server.ts`                                    | add `rename`/`recolour` already via `updateCourse` (`update` action exists on list; add a detail `save` action) |

---

## Task 1: Auth screens (login + signup)

**Files:**

- Modify: `src/routes/login/+page.svelte`, `src/routes/signup/+page.svelte`

Reference: lines 41-141 (split), 46-78 (brand panel → use `BrandPanel`), 80-140 (form: tabs, fields, CTA). Omit social buttons and forgot-password.

- [ ] **Step 1: Rebuild `login/+page.svelte`** — full-height split: `<BrandPanel />` + a centered form panel. Keep the existing client submit logic; add a `rememberMe` checkbox and tabs as links.

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import BrandPanel from '$lib/components/BrandPanel.svelte';
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(true);
	let error = $state('');
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await authClient.signIn.email({ email, password, rememberMe });
		if (res.error) error = res.error.message ?? 'Sign in failed';
		else await goto('/agenda');
	}
	const input =
		'h-[46px] w-full rounded-[11px] border border-line bg-white px-3.5 text-[15px] focus:border-pink-200 focus:outline-none';
	const tab = 'flex-1 h-[38px] rounded-[9px] text-sm font-semibold transition';
</script>

<div class="flex h-screen">
	<BrandPanel />
	<div class="flex flex-1 items-center justify-center p-10">
		<div class="w-full max-w-[392px]">
			<h2 class="m-0 mb-1.5 font-display text-[30px] font-medium tracking-[-0.015em]">
				Welcome back
			</h2>
			<p class="m-0 mb-6 text-[15px] text-grey-2">Sign in to pick up where you left off.</p>
			<div class="mb-6 flex gap-1 rounded-[12px] bg-tray p-1">
				<a
					href="/login"
					class={`${tab} flex items-center justify-center bg-white text-ink shadow-[0_1px_3px_rgba(43,37,48,0.08)]`}
					>Sign in</a
				>
				<a href="/signup" class={`${tab} flex items-center justify-center text-grey-2`}
					>Create account</a
				>
			</div>
			<form class="flex flex-col gap-3.5" onsubmit={submit}>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Email address</span>
					<input
						class={input}
						type="email"
						placeholder="you@email.com"
						bind:value={email}
						required
					/></label
				>
				<label class="block"
					><span class="mb-1.5 block text-[13px] font-semibold text-grey-1">Password</span>
					<input
						class={input}
						type="password"
						placeholder="••••••••"
						bind:value={password}
						required
					/></label
				>
				<label class="my-1.5 flex items-center gap-2 text-sm text-grey-1">
					<input type="checkbox" bind:checked={rememberMe} /> Keep me signed in</label
				>
				{#if error}<p class="text-sm text-danger">{error}</p>{/if}
				<button
					type="submit"
					class="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-pink text-[15.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(201,86,128,0.65)] hover:bg-pink-hover"
					>Sign in</button
				>
			</form>
		</div>
	</div>
</div>
```

- [ ] **Step 2: Rebuild `signup/+page.svelte`** identically but: title "Create your account", subtitle "Start planning your term in minutes.", the "Create account" tab active, an added "Full name" field bound to `name`, CTA "Create account", no remember-me (replace with the prototype's terms note, lines 116-118), and call `authClient.signUp.email({ name, email, password })`.

- [ ] **Step 3: Verify** `bun run check`; visit `/login` and `/signup` at desktop and ≤768px (brand panel hides, form full-width).

- [ ] **Step 4: Commit**

```bash
git add src/routes/login/+page.svelte src/routes/signup/+page.svelte
git commit -m "feat(auth): split brand+form reskin with remember-me"
```

---

## Task 2: Agenda

**Files:**

- Modify: `src/routes/(app)/agenda/+page.svelte`

Reference: 227-310 (cards, badge, pill, room, postpone menu). Data now includes `term`, and each item has `done`, `note`, `postponed`, `courseId`, `colour`, `postponeSlots`.

- [ ] **Step 1: Header** — `PageHeader` with `eyebrow={data.term ? \`This week · ${data.term}\` : 'This week'}`and`title="Agenda"`.

- [ ] **Step 2: Group sections** — for each group show label/date and a `count` = `${done}/${total} done` (compute `done = g.items.filter(i => i.done).length`). Use `dayFmt` (existing) for the date.

- [ ] **Step 3: Lesson card** per item (reference 252-303). Structure: a row `Card`-like div (`group relative`) containing:
  - **Done toggle** — a `form` posting `?/toggleDone` (`use:enhance`) with hidden `id` + `done={String(!item.done)}`; the submit button is the round check (green filled when `item.done`, check icon from `ICON.check`).
  - **PeriodBadge** `period={item.period}` `colour={item.colour}` `dim={item.done}`.
  - **Title** (strike + grey when done) + a row with a subject **pill** (`style="background:{subjectTint(item.colour).soft};color:{subjectTint(item.colour).text}"`), `Class {item.className}`, and a **Postponed** amber badge when `item.postponed` (bg `#FBF0DC` text `#9C7430`).
  - **Room** (pin icon + `item.room`).
  - **Postpone** clock button toggling a `Menu` (bind a local `openId` state). Inside the menu, header "Postpone to", then one `form action="?/postpone"` (`use:enhance`) per `item.postponeSlots` slot with hidden `id`/`date`/`period`/`room` and a button labelled by a formatted date + `P{period}`. If `postponeSlots` is empty show "No free slots".
  - Whole card is a link to the lesson: wrap title area in `<a href="/classes/{item.classId}/lessons/{item.id}">` (open the scheduled lesson) — or keep the existing open behaviour; ensure the toggle/postpone buttons `stopPropagation`/are outside the link.

Local state pattern:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PeriodBadge from '$lib/components/PeriodBadge.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import { subjectTint } from '$lib/colour';
	let { data, form } = $props();
	let openId = $state<number | null>(null);
	const fmtSlot = (d: string) =>
		new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(
			new Date(`${d}T00:00:00Z`)
		);
	// ...dayFmt + label() as before
</script>
```

- [ ] **Step 4: Keep** the `EmptyState` for `data.groups.length === 0` and the `form?.moveError` message.

- [ ] **Step 5: Responsive** — cards already full-width single column; ensure the postpone/done controls are tap-reachable (they're always visible here, not hover-gated). Verify ≤768px.

- [ ] **Step 6: Verify** `bun run check`; toggle done (persists), postpone to a listed slot (moves + amber badge appears).

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/agenda/+page.svelte"
git commit -m "feat(agenda): card reskin with done + postpone dropdown"
```

---

## Task 3: Calendar

**Files:**

- Modify: `src/routes/(app)/calendar/+page.svelte`

Reference: 313-379. Keep `?start=` nav + `weekLetter`.

- [ ] **Step 1: Day list** — extend the `days` array to all 7 (`Mon..Sun`) filtered by `data.config.teachingDays` (so weekend support from Plan 2 shows). Compute `today` ISO client-side to mark the current column.

- [ ] **Step 2: Rebuild grid** as the handoff white card with rounded period rows (reference 335-367): a header row (day name + date number; today's number gets a filled pink circle, ref 1719-1729) and one row per period with a left "PERIOD n" gutter and one cell per day. Filled cells use `subjectTint(l.colour)`: `style="background:{t.bg};border-left:3px solid {t.dot}"` with class name (bold, `t.text`), title, room. Empty cells: dashed "Free".

- [ ] **Step 3: Legend** — below the grid, list distinct courses/subjects with colour dots (reference 369-376).

- [ ] **Step 4: Responsive** — wrap the grid in `<div class="overflow-x-auto">` and give the grid a `min-w-[720px]` so it scrolls on narrow screens.

- [ ] **Step 5: Verify** `bun run check`; nav prev/next works; today highlighted; scrolls at ≤768px.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/calendar/+page.svelte"
git commit -m "feat(calendar): handoff grid, today highlight, scroll-x"
```

---

## Task 4: Timetable

**Files:**

- Modify: `src/routes/(app)/timetable/+page.svelte`

Reference: 1007-1077, cell menu 1044-1061. Backend `setSlot`/`clearSlot` unchanged; cells tinted by **class** colour (`data.classes[].colour` is now per-class).

- [ ] **Step 1: Week toggle** — replace the bespoke buttons with `SegmentedControl` (`value={week}`, options Week A/Week B) shown only when `data.config.cycleWeeks === 2`. Keep `let week = $state<'A'|'B'>('A')`.

- [ ] **Step 2: Days** — extend to 7, filtered by `teachingDays`.

- [ ] **Step 3: Cell** — replace the inline `<select>`+room with a clickable cell that opens a `Menu` (local `openKey` state keyed by `${week}|${day}|${period}`). Filled cell shows class name (tinted `subjectTint(cls.colour)`, `border-left:3px solid cls.colour`) + "Tap to change"; empty shows a `+`. The menu contains:
  - "Assign class" header, then a button per `data.classes` → submits a `?/set` form (hidden `weekLetter`/`dayOfWeek`/`period`/`classId`, default `room`) via `use:enhance`, then closes.
  - a **Room** input bound to the slot's room that submits `?/set` on blur (preserve current room behaviour) — include `classId` of the current slot.
  - if filled, a "Clear slot" button → `?/set` with `classId=0`? No — current clear uses selecting "— free —" (classId 0). Keep: a form to `?/set` with `classId=0` clears (the server action maps 0 → clearSlot — verify the existing action; if it uses a separate `?/clear`, use that). Match the existing server action contract.

Wrap each cell in a `relative` container so the `Menu` positions under it.

- [ ] **Step 4: Legend** — class colour dots + names (reference 1067-1073).

- [ ] **Step 5: Responsive** — `overflow-x-auto` wrapper + `min-w-[720px]` grid.

- [ ] **Step 6: Verify** `bun run check`; assign a class to a cell, set a room, clear a cell; week A/B switches.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/timetable/+page.svelte"
git commit -m "feat(timetable): popup cell editor with room, class-colour tints"
```

---

## Task 5: Courses list

**Files:**

- Modify: `src/routes/(app)/courses/+page.svelte`

Reference: 797-833 (subject list rows + add row).

- [ ] **Step 1:** `PageHeader` eyebrow "Your teaching subjects", title "Courses". Render each course as a `Card hover` row linking to `/courses/{id}`: an icon tile (`subjectTint(c.colour).bg`/`.dot`, book icon ref 811), name + meta (e.g. module/resource counts if available, else just name), a hover-revealed delete form (`?/delete`), and a chevron. Add a dashed "Add course" row that reveals/links to the create form.

- [ ] **Step 2:** Restyle the create form (name input + `type="color"` swatch styled + Add button).

- [ ] **Step 3:** Verify `bun run check`; create/delete still work.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/courses/+page.svelte"
git commit -m "feat(courses): list reskin"
```

---

## Task 6: Course detail

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/+page.svelte`
- Modify: `src/routes/(app)/courses/[courseId]/+page.server.ts` (add a `save` action using `updateCourse`)

Reference: 899-1005 (breadcrumb, inline name+swatch, modules DnD list, resources aside).

- [ ] **Step 1: Add a `save` action** to the course detail server (rename + recolour via existing `updateCourse`):

```ts
	save: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateCourse(userId, Number(event.params.courseId), String(form.get('name')), String(form.get('colour')));
	},
```

(Import `updateCourse`.)

- [ ] **Step 2: Header** — breadcrumb ("Courses › name"), an editable colour swatch button + name input. The swatch is a `<label>` wrapping a hidden `<input type="color" name="colour">`; both swatch-change and name-blur submit the `?/save` form (`use:enhance`). Meta line: `{modules.length} modules · {resCount} resources`.

- [ ] **Step 3: Modules list with DnD** — mirror the class-detail dnd pattern (`dndzone`, `handleConsider`/`handleFinalize` → POST `?/reorder` with `orderedIds`, then `invalidateAll`). Keep the ↑/↓ forms too (reference accessibility). Each module row: grip handle, tinted icon tile (`subjectTint(course.colour)`), name + lesson count, chevron, links to the module. Dashed "Add module" row → existing `?/create`.

- [ ] **Step 4: Resources aside** — two-column (`flex flex-wrap gap-7`): modules column `flex-[3_1_420px]`, aside `flex-[1_1_300px]` with `ResourceLinks` (Web links card) and `ResourceFiles` (Files card) — wrap each in a `Card`-styled `<section>` with the icon+title+count header (reference 950-1001).

- [ ] **Step 5: Responsive** — the `flex-wrap` collapses the aside below the modules on narrow; verify ≤768px.

- [ ] **Step 6: Verify** `bun run check`; rename + recolour persist; drag-reorder persists; resources add/remove.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/+page.svelte" "src/routes/(app)/courses/[courseId]/+page.server.ts"
git commit -m "feat(course): detail reskin, inline edit, dnd modules"
```

---

## Task 7: Module detail

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte`

Reference: 382-537 (header w/ Edit + Assign, lesson sequence, resources aside) + assign modal 1082-1121. Backend (Plan 2) provides `saveDescription`, `saveLessonNote`, lesson `attachmentCount`, multi-class assign via looping `?/assign`.

- [ ] **Step 1: Header** — breadcrumb (course → Module), inline module title (input → `?/rename`, `use:enhance`) + inline description (input → `?/saveDescription`), meta (`{lessons.length} lessons · {attachTotal} attachments`), and an **"Assign to class"** button that opens the modal.

- [ ] **Step 2: Assign modal** — use `Modal` (local `assignOpen` state). Header (reference 1086-1097), a checkbox list of `data.classes` (the course's eligible classes; local `selected: number[]` state), footer with Cancel + a confirm button labelled `Assign to N class(es)` (disabled when none). On confirm, submit one `?/assign` per selected class. Simplest robust approach: a single hidden form per class isn't ergonomic — instead POST sequentially via `fetch('?/assign', {body})` for each id then `invalidateAll()` and close:

```svelte
	async function confirmAssign() {
		for (const id of selected) {
			const body = new FormData();
			body.set('classId', String(id));
			await fetch('?/assign', { method: 'POST', body });
		}
		assignOpen = false;
		selected = [];
		await invalidateAll();
	}
```

(Keep the server `?/assign` action as-is — single class per call.)

- [ ] **Step 3: Lesson sequence with DnD** — `dndzone` over `data.lessons` (same pattern as class detail), POST `?/reorder`. Each lesson row (reference 428-471): grip, number badge (`subjectTint(course.colour)` — note: module page has `data.module` but needs course colour; the load returns `module` only. Add `courseColour` to the module load select or fetch course; simplest: include `course.colour` via `getModule` join or add to load. **Add** `courseColour` to the load by fetching `getCourse(userId, mod.courseId)` and passing `courseColour: course.colour`). Title input (`?/rename`), objective/note input (`?/saveLessonNote`), an attachment-count chip (`📎 {l.attachmentCount}` when > 0), open + delete buttons (hover-revealed, focus/touch accessible), and ↑/↓ forms. Dashed "Add a lesson" row → `?/create`.

- [ ] **Step 4: Resources aside** — module-owned `ResourceLinks`/`ResourceFiles` in the two-column layout (same as Task 6 Step 4).

- [ ] **Step 5: Verify** `bun run check`; rename/describe/note persist; reorder persists; assign-to-2-classes schedules into both; counts show.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/modules/[moduleId]/+page.svelte"
git commit -m "feat(module): detail reskin, inline edit, dnd, assign modal"
```

> NOTE: if Step 3 needs `courseColour`, also edit the module `+page.server.ts` load to add it (e.g. `const course = await getCourse(userId, mod.courseId); return { ..., courseColour: course?.colour ?? '#8775c6' }`). Commit that with this task.

---

## Task 8: Lesson pages (template + scheduled)

**Files:**

- Modify: `src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.svelte`
- Modify: `src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.svelte`
- Modify the two `+page.server.ts` to add a `saveNote` action and a `rename` action if missing (template uses `updateLessonNote`/`renameLesson`; scheduled uses `updateScheduledLessonNote`/`renameScheduledLesson`). `note` must be in each load select (template `getLesson` already updated in Plan 2; for scheduled add `note: scheduledLesson.note` to `getScheduledLesson`).

Reference: 539-640 (back button, pill + position, inline title/objective, editor card, resources aside).

- [ ] **Step 1: Add server actions** (template page) `rename` + `saveNote`:

```ts
	rename: async (event) => { const u=requireUserId(event); const f=await event.request.formData(); await renameLesson(u, Number(event.params.lessonId), String(f.get('title'))); },
	saveNote: async (event) => { const u=requireUserId(event); const f=await event.request.formData(); await updateLessonNote(u, Number(event.params.lessonId), String(f.get('note'))); },
```

Scheduled page equivalents use `renameScheduledLesson` / `updateScheduledLessonNote` with `event.params.scheduledLessonId`. (`savePlan` already exists.)

- [ ] **Step 2: Rebuild both `+page.svelte`** with the shared structure:
  - Back button (`← {moduleName}` / `← {className}`).
  - Subject pill (`subjectTint(courseColour)`) + position text (template: "Lesson n of m" — needs index; scheduled: "Planned lesson"). For the template position, the load can compute index via `listLessons`; if not readily available, show the module name only — keep simple, show pill + module/class name.
  - Inline **title** input (Fraunces 33px, `?/rename` on blur) + inline **objective** input (`?/saveNote` on blur), both `use:enhance`.
  - Two-column (`flex flex-wrap gap-7`): editor column `flex-[3_1_420px]` containing the `LessonPlanEditor` wrapped in the card frame (header "Lesson plan" + autosave dot — the component already renders status; add the header bar around it); resources aside `flex-[1_1_300px]` with `ResourceLinks` + `ResourceFiles` (ownerType `lesson`/`scheduled`).

- [ ] **Step 3: Responsive** — `flex-wrap` stacks aside below the editor; verify ≤768px.

- [ ] **Step 4: Verify** `bun run check`; edit title/objective (persist), plan autosaves, resources work, on both lesson types.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.svelte" "src/routes/(app)/courses/[courseId]/modules/[moduleId]/lessons/[lessonId]/+page.server.ts" "src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.svelte" "src/routes/(app)/classes/[classId]/lessons/[scheduledLessonId]/+page.server.ts" src/lib/server/queries/schedule.ts
git commit -m "feat(lesson): two-column reskin, inline title+objective"
```

---

## Task 9: Settings (incl. Account card)

**Files:**

- Modify: `src/routes/(app)/settings/+page.svelte`

Reference: 642-795 (Account, Timetable, Terms, Closures, Log out cards).

- [ ] **Step 1: Account card** (client-side better-auth). Local state for email + password fields; two actions:

```svelte
	import { authClient } from '$lib/auth-client';
	let email = $state(data.user?.email ?? '');
	let currentPassword = $state(''); let newPassword = $state(''); let acctMsg = $state('');
	async function saveEmail() {
		acctMsg = '';
		const r = await authClient.changeEmail({ newEmail: email });
		acctMsg = r.error ? (r.error.message ?? 'Email update failed') : 'Email updated (check inbox if verification is required).';
	}
	async function changePassword() {
		acctMsg = '';
		const r = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
		acctMsg = r.error ? (r.error.message ?? 'Password change failed') : 'Password changed.';
		currentPassword = ''; newPassword = '';
	}
```

(`data.user` comes from the `(app)` layout load. If `changeEmail`/`changePassword` aren't on the client type, cast via `authClient as any` and note it — they're standard better-auth methods. Show `acctMsg` under the card.)

Render the card (reference 653-680): email input + "Update" button (`onclick={saveEmail}`); current + new password inputs + "Change" button (`onclick={changePassword}`).

- [ ] **Step 2: Timetable card** — keep the existing `?/saveConfig` form but restyle. Cycle = the prototype's "1 week / 2 weeks" buttons (reference 692-699). Teaching days = `Mon..Sun` toggle pills (reference 701-707) — render all 7, `checked` from `data.config.teachingDays`; submit as multiple `teachingDays` checkbox inputs (the server now accepts 1..7). Periods = **count** stepper (`<input type=number name=periodsPerDay>`), NOT named periods. Anchor week select stays.

- [ ] **Step 3: Terms card** (teaching blocks) — restyle the list + add form (reference 728-753) using the existing `?/addBlock`/`?/deleteBlock` actions (name/start/end).

- [ ] **Step 4: Closures card** — restyle (reference 755-779); the add form now includes a **name** input + date (Plan 2 `addClosure(name, date)`); list shows `{c.name}` + `{c.date}` with delete.

- [ ] **Step 5: Log out card** (reference 781-791) — button calling the layout's sign-out (import `authClient` + `goto`, or move sign-out into a small action).

- [ ] **Step 6: Verify** `bun run check`; change password (works), toggle a weekend day + save (persists, agenda reflows), add a named closure.

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/settings/+page.svelte"
git commit -m "feat(settings): reskin + Account card + weekend days + named closures"
```

---

## Task 10: Classes list

**Files:**

- Modify: `src/routes/(app)/classes/+page.svelte`

- [ ] **Step 1:** `PageHeader` eyebrow "Your teaching groups", title "Classes". Each class as a `Card hover` row: colour dot (`c.colour`), name link `/classes/{id}`, `c.courseName` meta, hover delete (`?/delete`), chevron.

- [ ] **Step 2:** Create form: name input + course `<select>` + a `type="color"` swatch (`name="colour"`, default `#8775c6`) + Add button (the `create` action now accepts colour — Plan 2 Task 2).

- [ ] **Step 3:** Verify `bun run check`; create a class with a colour (sidebar dot reflects it).

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/classes/+page.svelte"
git commit -m "feat(classes): list reskin with colour"
```

---

## Task 11: Class detail

**Files:**

- Modify: `src/routes/(app)/classes/[classId]/+page.svelte`
- Modify: `src/routes/(app)/classes/[classId]/+page.server.ts` (add a `save` action for class name+colour via `updateClass`; load already uses `getClassWithCourse` → now returns `colour` + `courseColour`)

Reference: 835-897 (header, grouped lessons) — but keep our existing rich editable sequence (dnd, rename, insert-blank, overflow), just restyled.

- [ ] **Step 1: Add `save` action** to the class server (rename + recolour). `updateClass` needs `courseId`; pass the class's existing courseId (from load) as a hidden field:

```ts
	save: async (event) => {
		const u = requireUserId(event);
		const f = await event.request.formData();
		await updateClass(u, Number(event.params.classId), String(f.get('name')), Number(f.get('courseId')), String(f.get('colour')));
	},
```

- [ ] **Step 2: Header** — eyebrow "Class", inline colour swatch + name input (`?/save`, hidden `courseId={data.klass.courseId}`), subtitle (course name / lesson count).

- [ ] **Step 3: Sequence** — keep the existing `dndzone` + actions (`reorder`, `rename`, `insertBlank`, `delete`, overflow marker) but restyle rows to the handoff look: per-row use `PeriodBadge` where dated, a subject pill (`subjectTint(data.klass.courseColour)`), date/period text, inline title input, room chip, hover-revealed Open/+Blank/Delete (focus/touch accessible). Preserve `firstOverflowId` overflow notice.

- [ ] **Step 4: Responsive** — single column; ensure row controls wrap/are reachable at ≤768px.

- [ ] **Step 5: Verify** `bun run check`; rename + recolour class (sidebar reflects), dnd reorder, insert blank, delete all still work.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(app)/classes/[classId]/+page.svelte" "src/routes/(app)/classes/[classId]/+page.server.ts"
git commit -m "feat(class): detail reskin, inline name+colour"
```

---

## Task 12: Final responsive + full verification sweep

- [ ] **Step 1: Type + lint + format**

Run: `bun run check && bun run lint`
Expected: PASS (run `bun run format` first if needed).

- [ ] **Step 2: All node specs**

Run: `bunx vitest run --project server`
Expected: PASS.

- [ ] **Step 3: All component specs (per file)**

Run per file: `bunx vitest run --project client src/lib/components/<name>.svelte.test.ts`
Expected: PASS (Button, PeriodBadge, SegmentedControl, ResourceLinks, ResourceFiles, LessonPlanEditor).

- [ ] **Step 4: Manual pass at 1280 / 1024 / 768px** — `bun run dev`, walk every screen:
  - sidebar present; My classes dots use per-class colours.
  - auth stacks ≤768; calendar + timetable scroll-x ≤768; lesson/course/module asides stack.
  - agenda done + postpone; timetable popup + room + clear; assign modal; dnd reorders; inline edits persist; settings account/weekend/closures.
  - no console errors.

- [ ] **Step 5: Finish the branch** — invoke `superpowers:finishing-a-development-branch` to decide merge/PR.

---

## Self-review notes

- Spec §5 every screen → Tasks 1-11. ✓ (Auth, Agenda, Calendar, Timetable, Courses, Course detail, Module detail, Lesson ×2, Settings, Classes, Class detail.)
- Spec §6 responsive → per-screen responsive steps + Task 12 Step 4. ✓
- Spec interactions: done/postpone (T2), assign modal (T7), dnd modules/lessons (T6/T7), popup timetable (T4), inline edits (T6/T7/T8/T11), Account card (T9), weekend/closures (T9). ✓
- Type consistency: `subjectTint(...).{bg,soft,text,dot,bar}` used uniformly; `data.klass.colour` (class) vs `courseColour` (subject pills) on class detail (T11) matches Plan 2 `getClassWithCourse`; module page needs `courseColour` added to its load (noted T7).
- Placeholder scan: no TBD/TODO; the one conditional (`courseColour` on module load) is spelled out in the T7 note. better-auth `changeEmail/changePassword` flagged as possibly needing an `as any` cast.
