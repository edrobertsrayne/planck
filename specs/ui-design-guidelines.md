# Planck UI Design Guidelines

This document defines the visual design system for Planck, a lesson planning tool for UK secondary Physics teachers.

## Design Philosophy

Planck's interface should feel **calm, organised, and professional** while maintaining warmth appropriate for an educational tool. The design balances:

- **Clarity**: Teachers need to quickly scan schedules and find information
- **Efficiency**: Reduce cognitive load with consistent patterns and clear hierarchy
- **Flexibility**: Support both quick glances and deep planning sessions
- **Playfulness**: Subtle scientific personality without being childish

### Branding Direction

Planck embraces a **playful educational** aesthetic - friendly and approachable with hints of physics/science theming. Think warm and inviting rather than cold and clinical. The serif display font (Fraunces) adds character and a nod to academic tradition, while the interface remains modern and usable.

---

## Color System

### Core Palette

A muted, accessible color scheme that works in both light and dark modes.

| Name         | Hex       | Role                                            |
| ------------ | --------- | ----------------------------------------------- |
| **Amber**    | `#F0A868` | Primary accent, CTAs, warmth, highlights        |
| **Charcoal** | `#39393A` | Dark mode backgrounds, primary text             |
| **Sage**     | `#88BB92` | Success states, KS3 indicator                   |
| **Coral**    | `#E54F6D` | Emphasis, A-Level indicator, decorative accents |
| **Steel**    | `#6D9DC5` | Information, links, GCSE indicator              |

### Semantic Colors

#### Light Mode

```css
:root {
	/* Backgrounds */
	--background: #fafafa;
	--background-subtle: #f5f5f5;
	--background-muted: #ebebeb;

	/* Surfaces (cards, modals) */
	--surface: #ffffff;
	--surface-raised: #ffffff;
	--surface-overlay: rgba(255, 255, 255, 0.95);

	/* Text */
	--text-primary: #39393a;
	--text-secondary: #6b6b6c;
	--text-muted: #9a9a9b;
	--text-inverse: #fafafa;

	/* Borders */
	--border: #e0e0e0;
	--border-subtle: #ebebeb;
	--border-strong: #cccccc;

	/* Primary Accent (Amber) */
	--accent-primary: #f0a868;
	--accent-primary-hover: #e89b55;
	--accent-primary-muted: rgba(240, 168, 104, 0.15);
	--accent-primary-text: #39393a; /* Dark text on amber for contrast */

	/* Secondary Accent (Steel) */
	--accent-secondary: #6d9dc5;
	--accent-secondary-hover: #5a8db8;
	--accent-secondary-muted: rgba(109, 157, 197, 0.15);

	/* Semantic */
	--success: #88bb92;
	--success-muted: rgba(136, 187, 146, 0.15);
	--warning: #f0a868;
	--warning-muted: rgba(240, 168, 104, 0.15);
	--error: #e54f6d;
	--error-muted: rgba(229, 79, 109, 0.15);
	--info: #6d9dc5;
	--info-muted: rgba(109, 157, 197, 0.15);

	/* Interactive */
	--focus-ring: rgba(109, 157, 197, 0.5);
	--selection: rgba(240, 168, 104, 0.25);
}
```

#### Dark Mode

```css
.dark {
	/* Backgrounds */
	--background: #1a1a1b;
	--background-subtle: #242425;
	--background-muted: #2e2e2f;

	/* Surfaces */
	--surface: #242425;
	--surface-raised: #2e2e2f;
	--surface-overlay: rgba(36, 36, 37, 0.95);

	/* Text */
	--text-primary: #f5f5f5;
	--text-secondary: #b8b8b9;
	--text-muted: #7a7a7b;
	--text-inverse: #39393a;

	/* Borders */
	--border: #3d3d3e;
	--border-subtle: #333334;
	--border-strong: #4a4a4b;

	/* Primary Accent (Amber - slightly brighter for dark bg) */
	--accent-primary: #f5b87a;
	--accent-primary-hover: #f8c68e;
	--accent-primary-muted: rgba(240, 168, 104, 0.2);
	--accent-primary-text: #1a1a1b; /* Dark text on amber */

	/* Secondary Accent (Steel - slightly brighter) */
	--accent-secondary: #7dadd5;
	--accent-secondary-hover: #8dbde5;
	--accent-secondary-muted: rgba(109, 157, 197, 0.2);

	/* Semantic (adjusted for dark backgrounds) */
	--success: #98cba2;
	--success-muted: rgba(136, 187, 146, 0.2);
	--warning: #f5b87a;
	--warning-muted: rgba(240, 168, 104, 0.2);
	--error: #f06580;
	--error-muted: rgba(229, 79, 109, 0.2);
	--info: #7dadd5;
	--info-muted: rgba(109, 157, 197, 0.2);

	/* Interactive */
	--focus-ring: rgba(125, 173, 213, 0.5);
	--selection: rgba(240, 168, 104, 0.3);
}
```

### Key Stage Colors

Classes and year groups are colored by key stage for quick visual identification:

| Key Stage   | Years   | Color | Light Mode | Dark Mode |
| ----------- | ------- | ----- | ---------- | --------- |
| **KS3**     | 7, 8, 9 | Sage  | `#88BB92`  | `#98CBA2` |
| **GCSE**    | 10, 11  | Steel | `#6D9DC5`  | `#7DADD5` |
| **A-Level** | 12, 13  | Coral | `#E54F6D`  | `#F06580` |

### Class Colors

Individual classes receive unique colors for calendar and list views:

- **Assignment**: Auto-assigned from a harmonious preset palette
- **Override**: Users can change a class's color from the preset options
- **Palette**: 8-10 distinct colors that work in both light and dark modes

```css
:root {
	--class-color-1: #f0a868; /* Amber */
	--class-color-2: #88bb92; /* Sage */
	--class-color-3: #6d9dc5; /* Steel */
	--class-color-4: #e54f6d; /* Coral */
	--class-color-5: #b07aad; /* Lavender */
	--class-color-6: #7aada0; /* Teal */
	--class-color-7: #c4956a; /* Tan */
	--class-color-8: #8b8dc7; /* Periwinkle */
}
```

### User Accent Customisation

Users can select their preferred accent color from a preset list in Settings. This changes the primary accent throughout the app (buttons, links, active states) while maintaining the rest of the design system.

**Preset options**: Amber (default), Coral, Steel, Sage, Lavender, Teal

---

## Typography

### Font Stack

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');

:root {
	/* Display font for headings - distinctive serif with character */
	--font-display: 'Fraunces', Georgia, serif;

	/* Body font for UI text - clean and highly readable */
	--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

	/* Monospace for codes, spec references */
	--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale

| Name       | Font     | Size            | Weight | Line Height | Usage                       |
| ---------- | -------- | --------------- | ------ | ----------- | --------------------------- |
| `display`  | Fraunces | 2.25rem (36px)  | 600    | 1.2         | Hero text, welcome messages |
| `h1`       | Fraunces | 1.875rem (30px) | 600    | 1.3         | Page headings               |
| `h2`       | Fraunces | 1.5rem (24px)   | 600    | 1.35        | Section headings            |
| `h3`       | Fraunces | 1.25rem (20px)  | 500    | 1.4         | Card titles, subsections    |
| `h4`       | Inter    | 1.125rem (18px) | 600    | 1.4         | Small headings              |
| `body`     | Inter    | 1rem (16px)     | 400    | 1.5         | Default body text           |
| `body-sm`  | Inter    | 0.875rem (14px) | 400    | 1.5         | Secondary text, metadata    |
| `caption`  | Inter    | 0.75rem (12px)  | 400    | 1.4         | Labels, timestamps          |
| `overline` | Inter    | 0.75rem (12px)  | 500    | 1.4         | Category labels (uppercase) |

### Usage Guidelines

- **Fraunces** (display): Page titles, section headings, empty state headings, branding
- **Inter** (body): All other text - buttons, labels, body copy, navigation, forms

---

## Spacing & Layout

### Spacing Scale

Based on 4px increments:

| Token      | Value | Usage                    |
| ---------- | ----- | ------------------------ |
| `space-1`  | 4px   | Tight spacing, icon gaps |
| `space-2`  | 8px   | Compact elements         |
| `space-3`  | 12px  | Default inline spacing   |
| `space-4`  | 16px  | Standard padding         |
| `space-5`  | 20px  | Medium spacing           |
| `space-6`  | 24px  | Section padding          |
| `space-8`  | 32px  | Large gaps               |
| `space-10` | 40px  | Section separation       |
| `space-12` | 48px  | Major sections           |
| `space-16` | 64px  | Page-level spacing       |

### Border Radius

Rounded, friendly corners throughout:

| Token         | Value  | Usage                            |
| ------------- | ------ | -------------------------------- |
| `radius-sm`   | 8px    | Small elements, chips, tags      |
| `radius-md`   | 12px   | Buttons, inputs, small cards     |
| `radius-lg`   | 16px   | Cards, modals, panels            |
| `radius-full` | 9999px | Pills, avatars, circular buttons |

### Layout Grid

- **Max content width**: 1280px
- **Gutter**: 24px (desktop), 16px (tablet), 12px (mobile)

### Breakpoints

| Name  | Width  | Usage         |
| ----- | ------ | ------------- |
| `sm`  | 640px  | Large phones  |
| `md`  | 768px  | Tablets       |
| `lg`  | 1024px | Small laptops |
| `xl`  | 1280px | Desktops      |
| `2xl` | 1536px | Large screens |

---

## Components

### Buttons

All buttons use `radius-md` (12px) and have a minimum touch target of 44px.

#### Primary Button

```css
.btn-primary {
	background: var(--accent-primary);
	color: var(--accent-primary-text);
	font-weight: 500;
	padding: 12px 20px;
	border-radius: 12px;
	transition: background 0.15s ease;
}

.btn-primary:hover {
	background: var(--accent-primary-hover);
}
```

#### Secondary Button

```css
.btn-secondary {
	background: transparent;
	border: 1px solid var(--border-strong);
	color: var(--text-primary);
	padding: 12px 20px;
	border-radius: 12px;
}

.btn-secondary:hover {
	background: var(--background-muted);
}
```

#### Ghost Button

```css
.btn-ghost {
	background: transparent;
	color: var(--text-secondary);
	padding: 12px 20px;
	border-radius: 12px;
}

.btn-ghost:hover {
	background: var(--background-subtle);
}
```

#### Destructive Button

```css
.btn-destructive {
	background: var(--error);
	color: white;
	padding: 12px 20px;
	border-radius: 12px;
}
```

### Cards

```css
.card {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 16px;
	padding: 24px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	transition:
		box-shadow 0.2s ease,
		border-color 0.2s ease;
}

.card:hover {
	border-color: var(--border-strong);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.dark .card {
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dark .card:hover {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
```

### Form Inputs

```css
.input {
	border: 1px solid var(--border);
	border-radius: 12px;
	padding: 12px 16px;
	min-height: 44px;
	font-size: 1rem;
	background: var(--surface);
	transition:
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}

.input:focus {
	outline: none;
	border-color: var(--accent-secondary);
	box-shadow: 0 0 0 3px var(--focus-ring);
}
```

### Navigation

#### Desktop

- Horizontal navigation in header
- Active item: text in `--accent-primary` with 3px bottom border
- Hover: `--background-subtle` background with rounded corners
- Settings link included alongside Calendar, Classes, Modules, Specifications

#### Mobile

- Hamburger menu icon in header
- Opens slide-out drawer from right
- Full-height overlay with navigation links
- Tap outside or X button to close

---

## Drag and Drop

Drag and drop is central to Planck's lesson organisation workflow.

### Visual Language

#### Draggable Items

The entire card is draggable (no separate drag handles). Cursor changes to `grab` on hover.

```css
.draggable {
	cursor: grab;
	transition:
		transform 0.15s ease,
		box-shadow 0.15s ease;
	user-select: none;
}

.draggable:hover {
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.draggable.dragging {
	cursor: grabbing;
	transform: scale(1.02) rotate(1deg);
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
	z-index: 100;
	opacity: 0.95;
}

.dark .draggable.dragging {
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}
```

#### Drop Zones

```css
.drop-zone {
	border: 2px dashed var(--border);
	border-radius: 12px;
	background: var(--background-subtle);
	transition: all 0.2s ease;
}

.drop-zone.drag-over {
	border-color: var(--accent-primary);
	background: var(--accent-primary-muted);
}
```

#### Drop Indicator Line

Shows insertion point when dragging between items:

```css
.drop-indicator {
	height: 3px;
	background: var(--accent-primary);
	border-radius: 2px;
	margin: 4px 0;
	animation: drop-pulse 1s ease-in-out infinite;
}

@keyframes drop-pulse {
	0%,
	100% {
		opacity: 1;
		box-shadow: 0 0 8px var(--accent-primary);
	}
	50% {
		opacity: 0.7;
		box-shadow: 0 0 4px var(--accent-primary);
	}
}
```

### Drag and Drop Contexts

#### Topic View (Lesson Sequence)

- Lessons displayed as cards in a vertical list
- **Reorder within topic only** - cannot drag between topics
- Auto-numbered: Lessons show 1, 2, 3... that update in real-time during drag
- Drop indicator line shows insertion point
- To move lessons between topics, use a separate "Move to..." action

#### Calendar View

- Lessons shown in time slots on the timetable grid
- Drag to reschedule to different day/period
- **Shift behavior**: When dropping on an occupied slot, existing lessons shift forward one position (insert behavior, not swap)
- Ghost preview shows lesson in new position during drag
- Visual feedback shows which slots will be affected

### Keyboard Accessibility

All drag operations must have keyboard alternatives:

- Focus on draggable item
- Press Space or Enter to "pick up"
- Use Arrow keys to move position
- Press Space or Enter to "drop"
- Press Escape to cancel

Screen reader announcements for drag start, position changes, and drop completion.

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
	.draggable,
	.drop-zone,
	.drop-indicator {
		transition: opacity 0.2s ease;
		transform: none !important;
		animation: none !important;
	}
}
```

---

## Motion & Animation

### Principles

Planck uses **subtle** motion - smooth and functional without being distracting:

1. **Purposeful**: Animation clarifies relationships and state changes
2. **Quick**: Most transitions under 200ms
3. **Subtle**: No attention-grabbing effects
4. **Respectful**: Honor `prefers-reduced-motion`

### Duration Scale

| Name         | Duration | Usage                                |
| ------------ | -------- | ------------------------------------ |
| `fast`       | 100ms    | Micro-interactions (hovers, focuses) |
| `normal`     | 150ms    | Standard transitions                 |
| `slow`       | 250ms    | Complex state changes                |
| `deliberate` | 350ms    | Page/modal transitions               |

### Easing

```css
:root {
	--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
	--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### Common Animations

| Element             | Animation                            |
| ------------------- | ------------------------------------ |
| **Hover states**    | 100ms background/border color change |
| **Focus rings**     | 150ms box-shadow appearance          |
| **Card hover lift** | 150ms translateY + shadow            |
| **Modal open**      | 250ms fade + scale(0.98→1)           |
| **Toast enter**     | 250ms slide from right + fade        |
| **Page transition** | None (instant navigation)            |

---

## Icons

### Icon Set

Use [Lucide Icons](https://lucide.dev/) for consistency with shadcn-svelte.

### Sizes

| Size | Pixels | Usage                  |
| ---- | ------ | ---------------------- |
| `xs` | 14px   | Inline with small text |
| `sm` | 16px   | Buttons, inputs        |
| `md` | 20px   | Default                |
| `lg` | 24px   | Headers, navigation    |
| `xl` | 32px   | Empty states           |

### Icon + Text Spacing

- Gap between icon and text: 8px
- Icon-only buttons: Ensure 44px minimum touch target

---

## Empty States

Empty states should be **helpful** - providing guidance without being overwhelming.

### Structure

1. **Icon**: Relevant Lucide icon, 32-48px, muted color
2. **Heading**: Clear, friendly (Fraunces font)
3. **Description**: Brief explanation of what this area is for and how to get started
4. **Action**: Primary button to resolve the empty state

### Example

```svelte
<div class="empty-state">
	<CalendarIcon class="mb-4 h-12 w-12 text-muted-foreground" />
	<h3 class="font-display mb-2 text-xl font-semibold">No lessons scheduled</h3>
	<p class="mb-4 max-w-sm text-sm text-muted-foreground">
		Your calendar is empty. Add lessons to a topic first, then drag them here to schedule.
	</p>
	<Button>Go to Modules</Button>
</div>
```

### Tone

- Friendly, not patronising
- Action-oriented
- Brief - one or two sentences max

---

## Dark Mode

### Implementation

- **Default**: Follow system preference (`prefers-color-scheme`)
- **Toggle**: Sun/moon icon button in the header navbar
- **Persistence**: Save preference to `localStorage`

### Svelte Implementation

```svelte
<script lang="ts">
	import { browser } from '$app/environment';
	import { Sun, Moon } from 'lucide-svelte';

	let theme = $state<'light' | 'dark'>('light');

	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('theme');
			if (stored) {
				theme = stored as 'light' | 'dark';
			} else {
				theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			}
			document.documentElement.classList.toggle('dark', theme === 'dark');
		}
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		localStorage.setItem('theme', theme);
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}
</script>

<button
	onclick={toggleTheme}
	class="hover:bg-background-subtle rounded-lg p-2"
	aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
	{#if theme === 'light'}
		<Moon class="h-5 w-5" />
	{:else}
		<Sun class="h-5 w-5" />
	{/if}
</button>
```

### Dark Mode Adjustments

- **Shadows**: Increase opacity (0.2-0.4 instead of 0.05-0.1)
- **Borders**: Slightly more visible
- **Accent colors**: Slightly brighter to maintain contrast
- **Images**: Consider providing dark variants or subtle CSS filters

---

## Navigation Structure

### Main Navigation Items

1. **Calendar** - `/calendar`
2. **Classes** - `/classes`
3. **Modules** - `/modules`
4. **Specifications** - `/specifications`
5. **Settings** - `/settings`

### Settings Sub-navigation

- Timetable configuration
- Term dates
- Appearance (accent color, dark mode)
- Account (future)

---

## Responsive Patterns

### Mobile-First Approach

1. Design for 375px width first
2. Enhance for larger screens
3. Touch targets: Minimum 44x44px

### Adaptive Components

| Component    | Mobile                 | Desktop                      |
| ------------ | ---------------------- | ---------------------------- |
| Navigation   | Hamburger drawer       | Horizontal header            |
| Calendar     | Day view default       | Week view default            |
| Forms        | Full-width, stacked    | Multi-column grid            |
| Modals       | Full-screen            | Centered overlay (max 500px) |
| Tables       | Stacked card view      | Traditional table            |
| Lesson cards | Compact, swipe actions | Full detail, hover actions   |

---

## Accessibility Checklist

- [ ] Color contrast: Minimum 4.5:1 for text, 3:1 for UI elements
- [ ] Focus indicators: Visible 3px ring on all interactive elements
- [ ] Keyboard navigation: All functionality accessible via keyboard
- [ ] Screen readers: Proper ARIA labels, live regions for dynamic content
- [ ] Reduced motion: Respect `prefers-reduced-motion`
- [ ] Touch targets: Minimum 44px
- [ ] Error messages: Clear, associated with inputs via `aria-describedby`
- [ ] Skip links: "Skip to main content" link for keyboard users
- [ ] Drag and drop: Full keyboard alternative for all drag operations

---

## Implementation Priority

### Phase 1: Foundation

1. Update CSS custom properties with new color system
2. Import and configure Fraunces + Inter fonts
3. Implement dark mode toggle in header
4. Update border-radius values throughout

### Phase 2: Components

1. Restyle buttons with new colors and radius
2. Update card styles
3. Create consistent form input styling
4. Build empty state component

### Phase 3: Navigation

1. Add Settings to main navigation
2. Implement mobile hamburger drawer
3. Style active states with accent color

### Phase 4: Drag and Drop

1. Build draggable lesson card component
2. Implement topic view reordering
3. Build calendar drop zones
4. Implement shift-forward logic for calendar conflicts
5. Add keyboard alternatives

### Phase 5: Polish

1. Add subtle hover/focus animations
2. Implement user accent color preference
3. Accessibility audit and fixes
4. Responsive refinements
