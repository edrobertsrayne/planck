# Planck Frontend Design System — Design

**Date:** 2026-06-12
**Status:** Approved (design); pending implementation plan
**Scope:** A visual design pass over the existing planck app. Establishes a design-token system and restyles every existing page. **No new features, no backend/data changes, no logic changes** to load functions, form actions, or the scheduling library.

## Goal

Give planck a clean, modern, spacious interface in the spirit of Gmail / Google Drive: white background, no dark mode, a pink-led pastel palette, and an editorial serif for titles. Replace the current ad-hoc Tailwind utility classes (plain greys, default borders) with a consistent, token-driven system.

## Design Direction (settled during brainstorming)

- **Palette — "Bloom":** pink primary with a full equal-weight pastel accent set, chosen so subjects/classes can be colour-coded across the timetable.
- **App shell — top-bar + rail (Drive-style):** a global top bar (wordmark, search, primary CTA, account) above a slim icon+label nav rail.
- **Component language:** Inter for UI/body, Fraunces for titles; soft 10–14px radii; hairline rose-tinted borders + soft hover shadows (no heavy drop shadows); generous whitespace.
- **Background:** clean white throughout. **No tinted page layers.** Colour appears only on accents — primary actions, active/selected states, and subject colour-coding. Small control fills (inputs, tags) may use a near-white neutral.

## 1. Foundations (design tokens)

Implemented as Tailwind v4 `@theme` tokens in `src/routes/layout.css` so the whole app is utility-driven and consistent.

### Colour tokens

| Token | Value | Use |
|---|---|---|
| `--color-pink` | `#e8488b` | Primary actions, links, focus accents |
| `--color-pink-dk` | `#a21d6b` | Text on pink tints |
| `--color-pink-50` | `#fdf2f8` | Faint surface |
| `--color-pink-100` | `#fce7f3` | Active nav pill, chips, selected rows, hover |
| `--color-pink-200` | `#fbcfe8` | Hover borders |
| `--color-ink` | `#3a2f35` | Primary text (warm near-black) |
| `--color-muted` | `#a89aa1` | Secondary text |
| `--color-line` | `#f1e8ec` | Hairline borders |
| `--color-field` | `#f7f4f6` | Input / tag fills (near-white, faint warm) |
| `--color-bg` | `#ffffff` | Page background |

Neutrals are warm (rose-tinted), not cold grey.

### Subject colour-coding

A fixed pastel set, each paired with a darker accessible text tone, applied to period bars, calendar cells, and subject chips. Initial set:

| Subject | Fill | Text |
|---|---|---|
| English | `#ffd1dc` | `#9a3b54` |
| Science | `#bfe3f0` | `#2f6b86` |
| Maths | `#c7f0d8` | `#2f7d56` |
| History | `#ffe9b8` | `#946a18` |
| Geography | `#d9ccf2` | `#5a44a0` |
| Art | `#ffd9c2` | `#9a5530` |
| PE | `#cfece8` | `#2c7d72` |

The current data model already carries a per-lesson `colour` value; the design keeps using that field. A `subjectColour` helper maps a stable key (subject/course) onto the pastel set, with a deterministic fallback for unmapped subjects. Existing stored colours continue to render (used directly as the bar/cell fill); the helper governs new/derived colours and chip text tones. Exact mapping source (course field vs. subject name) is an implementation-plan detail.

### Typography

- **Fraunces** — page titles (`h1`) and section headings. Weights 600/700, tight tracking.
- **Inter** — all body, controls, labels, table content. Tabular figures (`font-variant-numeric: tabular-nums`) for periods, dates, times.
- Fonts self-hosted via `@fontsource` (`@fontsource-variable/fraunces`, `@fontsource-variable/inter` or equivalent) — no Google Fonts runtime dependency.

### Shape & elevation

- Radii: 8px small controls, 10–11px buttons/inputs, 12–14px cards.
- Borders: 1px `--color-line` hairlines.
- Shadows: none at rest; soft shadow on hover for interactive cards (`0 3px 12px rgba(80,20,50,.07)`).
- Focus: pink ring (`0 0 0 3px var(--color-pink-100)` + `--color-pink` border).

## 2. App shell — `src/routes/(app)/+layout.svelte`

Restructure from the current thin sidebar to **top-bar + rail**:

- **Top bar:** Fraunces "planck" wordmark; global search field (visual element — wiring search is out of scope, rendered as a non-functional or simple input placeholder); primary **＋ New lesson** button; account control (avatar) that holds **Sign out** (keeps existing `authClient.signOut()` → `/login` behaviour).
- **Nav rail:** icon + label items (Agenda, Calendar, Courses, Classes, Timetable), Settings pinned to the bottom. Active item uses the pink-100 pill with pink-dk text; hover uses `--color-field`. Active detection keeps the current `page.url.pathname.startsWith(...)` logic.
- Content area: white, generous padding (~28–32px).

Icons: a small inline-SVG set (no new heavy icon dependency), or a lightweight icon approach chosen in the plan.

**"New lesson" CTA:** for this styling pass it links to the most relevant existing flow (e.g. agenda/calendar). It does **not** introduce a new creation feature. If no suitable target exists, it renders as a styled control wired to an existing action only. Final target decided in the plan.

## 3. Components — new `src/lib/components/`

Reusable Svelte 5 components (runes) so pages stay declarative and consistent:

- `Button.svelte` — variants: `primary` / `secondary` / `ghost` / `danger`; sizes `md` / `sm`.
- `Field.svelte` + `Input.svelte` — label + input with the focus-ring styling; works with `@tailwindcss/forms`.
- `Chip.svelte` — pill; tones for week letter, status, subject.
- `Card.svelte` — hairline-bordered container with optional hover lift.
- `PageHeader.svelte` — Fraunces title + optional chip/actions slot + subtitle.
- `EmptyState.svelte` — icon + message for empty lists.
- `SubjectDot.svelte` / `subjectColour` helper — colour-coding primitives.

Each component has a single clear purpose and a small typed prop surface, so pages compose them without duplicating class strings.

## 4. Page-by-page application

Markup/class restyle only — data flow, load functions, and form actions unchanged. Existing `use:enhance` forms keep their `action`s and field `name`s; only presentation changes.

- **Agenda** (`(app)/agenda`) — day-grouped sections with Fraunces day headers; lesson cards with pastel subject bars, class, description, room tag; Move/Delete become `Button` (sm) controls (hover-revealed on desktop). `moveError` rendered in styled error text. Empty state via `EmptyState`.
- **Calendar** (`(app)/calendar`) — the roomier grid: taller cells, padded, lesson stacks class → title → room; empty periods show a quiet centred dot; pastel cell fills from subject colour; Week A/B `Chip`; styled prev/next + header.
- **Timetable** (`(app)/timetable`) — same grid language as Calendar.
- **Courses** (`(app)/courses`), **course detail** (`courses/[courseId]`), **modules** (`courses/[courseId]/modules/[moduleId]`) — `PageHeader` + card/clean-list layouts + `EmptyState`.
- **Classes** (`(app)/classes`) — same treatment.
- **Settings** (`(app)/settings`) — `Field`-based form sections.
- **Login / signup** (`/login`, `/signup`) — centred `Card` on clean white, Fraunces wordmark, styled `Field`s and primary `Button`. (In scope.)

## 5. Implementation order & verification

Build bottom-up so each step is viewable in the running app:

1. **Tokens & fonts** — `@theme` in `layout.css`, install/wire `@fontsource` fonts.
2. **Shell** — restyle `(app)/+layout.svelte` to top-bar + rail.
3. **Components** — add `src/lib/components/*`.
4. **Pages** — apply components/styles page by page.

**Verification:**

- No changes to load functions, form actions, or `src/lib/scheduling/*`.
- Existing Vitest + Playwright suites must stay green. They assert on text/roles, so a presentation-only restyle should not break them; any selector that breaks indicates markup that needs a compatible structure (e.g. preserve accessible names, button text, headings). Run `bun run test:unit -- --run` and `bun run test:e2e` after the restyle and fix any fallout in the markup, not by changing app logic.
- `bun run lint` and `bun run check` pass.
- Manual pass over each page in `bun run dev` to confirm spacing/contrast.

## Out of scope

- Dark mode.
- New features or data-model changes.
- Functional global search.
- A new lesson-creation flow beyond linking the CTA to an existing destination.
- Mobile-specific redesign (layout should remain usable but a dedicated responsive pass is not part of this work).

## Accessibility notes

- Primary pink `#e8488b` carries white text at ≥4.5:1 for the button sizes used; tint surfaces always pair with the darker `-dk`/subject text tones for contrast.
- Keep accessible names/headings stable so existing tests and screen readers are unaffected.
