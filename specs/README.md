# Planck Specifications

This folder contains the specification documents for Planck, a lesson planning and scheduling tool for UK secondary Physics teachers.

## Document Index

| Document                                             | Description                                                                                              | Last Updated |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| [v1-specification.md](./v1-specification.md)         | Product specification defining core concepts, data model, user workflows, and v1 scope                   | Feb 2025     |
| [ui-design-guidelines.md](./ui-design-guidelines.md) | Visual design system including colors, typography, components, drag-and-drop patterns, and accessibility | Feb 2025     |

---

## Quick Reference

### v1-specification.md

**Purpose**: Defines _what_ Planck does and _how_ it works.

**Key sections**:

- **Core Concepts** — Exam specifications, classes, timetables, modules, lessons, calendar events
- **User Workflows** — Setting up academic year, creating modules, assigning to classes, managing calendar
- **Views** — Calendar (day/week/term), class view, module library, specification browser
- **Data Model** — Entity relationships and schema overview
- **Success Criteria** — What v1 must deliver

**Use when**: Understanding product requirements, data structures, or feature scope.

---

### ui-design-guidelines.md

**Purpose**: Defines _how_ Planck looks and _feels_.

**Key sections**:

- **Color System** — Core palette (Amber, Charcoal, Sage, Coral, Steel), light/dark mode tokens, key stage colors
- **Typography** — Fraunces (display) + Inter (body), type scale
- **Spacing & Layout** — 4px-based spacing, border radius (12-16px rounded), breakpoints
- **Components** — Buttons, cards, forms, navigation patterns
- **Drag and Drop** — Visual language, topic reordering, calendar scheduling, shift-forward behavior
- **Motion** — Subtle animations, duration scale, reduced motion support
- **Dark Mode** — System preference default, toggle implementation
- **Accessibility** — Checklist and requirements
- **Implementation Priority** — 5-phase rollout plan

**Use when**: Implementing UI components, styling, or interaction patterns.

---

## How to Use These Specs

1. **Starting a new feature?** Check `v1-specification.md` for requirements and data model
2. **Building UI?** Follow `ui-design-guidelines.md` for styling and patterns
3. **Questions about scope?** See "Out of Scope for v1" in the product spec
4. **Implementation order?** See "Implementation Priority" in the design guidelines

## Related Documentation

- [`CLAUDE.md`](../CLAUDE.md) — Development setup, tech stack, commands (source of truth for tooling)
- [`src/lib/server/db/schema.ts`](../src/lib/server/db/schema.ts) — Database schema implementation
