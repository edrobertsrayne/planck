# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planck is a lesson planning and scheduling tool for UK secondary Physics teachers.

## Tech Stack (Source of Truth)

This section is the single source of truth for the project's technology choices.

| Layer         | Technology              | Documentation                 |
| ------------- | ----------------------- | ----------------------------- |
| Framework     | SvelteKit with Svelte 5 | https://svelte.dev/docs       |
| UI Components | shadcn-svelte           | https://www.shadcn-svelte.com |
| Styling       | Tailwind CSS v4         | https://tailwindcss.com/docs  |
| Database      | SQLite with Drizzle ORM | https://orm.drizzle.team/docs |
| Runtime       | Bun                     | https://bun.sh/docs           |

## Development Commands

```sh
# Start development server (exposed on local network with --host)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Type checking
bun run check
bun run check:watch  # watch mode

# Linting and formatting
bun run lint         # check formatting and lint
bun run format       # auto-format code

# Testing
bun run test         # run all tests once
bun run test:unit    # run tests in watch mode

# Database schema management
bunx drizzle-kit generate   # generate migration from schema changes
bunx drizzle-kit migrate    # apply migrations to database
bunx drizzle-kit studio     # open Drizzle Studio GUI
```

## Git Commit Requirements

**CRITICAL**: All commits must pass pre-commit hooks that automatically run:

- `eslint` - Linting with auto-fix
- `prettier` - Auto-formatting
- `bun run check` - Type checking
- `bun run test:unit -- --run` - Unit tests

If hooks fail, fix the issues before the commit will be allowed. These hooks are enforced by `.pre-commit-config.yaml`.

## Testing Architecture

Vitest is configured with two separate test projects to handle different testing contexts:

1. **Client tests** (`*.svelte.test.ts` or `*.svelte.spec.ts`): Run in browser using Playwright/Chromium for testing Svelte components
2. **Server tests** (`*.test.ts` or `*.spec.ts` excluding svelte files): Run in Node.js environment for testing server-side code

Tests in `src/lib/server/**` are automatically excluded from browser tests.

## SvelteKit Architecture

### File-Based Routing Pattern

The app follows SvelteKit's file-based routing convention:

- `+page.svelte` - UI component for the route
- `+page.server.ts` - Server-side logic (load functions, form actions)
- `+layout.svelte` - Shared layout wrapper
- `+layout.ts` / `+layout.server.ts` - Layout load functions

### Data Loading Pattern

Server-side `load` functions fetch data and return it as props to components:

```typescript
// +page.server.ts
export const load: PageServerLoad = async () => {
	const data = await db.select().from(table);
	return { data };
};

// +page.svelte
let { data } = $props(); // data is automatically typed and available
```

### Form Actions Pattern

Use SvelteKit form actions for mutations:

```typescript
// +page.server.ts
export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    // ... process and insert data
    return { success: true };
  }
};

// +page.svelte
<form method="POST" action="?/create" use:enhance>
  <!-- form fields -->
</form>
```

**IMPORTANT**: After successful form submissions that modify data, call `invalidateAll()` from `$app/navigation` to refresh page data and prevent stale UI state:

```typescript
import { invalidateAll } from '$app/navigation';

$effect(() => {
	if (form?.success) {
		invalidateAll(); // Refresh page data
		// ... other success handling
	}
});
```

## Database Architecture

### Schema Location

- Main schema: `src/lib/server/db/schema.ts`
- Database client: `src/lib/server/db/index.ts`

### Data Model

The database follows a hierarchical structure for UK Physics education:

1. **Courses** (`course`) - Top-level teaching units (e.g. "GCSE Physics", "Year 9 Physics") with Editor.js notes
2. **Modules** (`module`) - Reusable teaching units belonging to a course, with Editor.js notes
3. **Lessons** (`lesson`) - Individual lessons within modules, with Editor.js block content
4. **Classes** (`teachingClass`) - Teaching groups optionally linked to a course (yearGroup 7-13)
5. **Module Assignments** (`moduleAssignment`) - Links modules to classes with a start date
6. **Timetable** - Period slots and scheduled lessons with calendar integration
7. **Events** - Holidays, school closures, and absences

### Database Patterns

- Uses Drizzle ORM with `@libsql/client` (async API with `client.execute()`)
- Local files use `file:` URL prefix (e.g., `file:local.db`)
- All IDs are UUIDs generated with `crypto.randomUUID()`
- Timestamps use `integer` with `{ mode: 'timestamp' }`
- Foreign keys use cascade deletes where appropriate
- Queries use `.leftJoin()` for optional relations

### Environment Configuration

Required environment variables (see `.env.example`):

- `DATABASE_URL`: SQLite database file path (defaults to `local.db` for local development)

## Project Structure

```
src/
├── lib/
│   ├── assets/                # Static assets
│   ├── components/ui/         # shadcn-svelte components
│   ├── server/
│   │   ├── db/               # Database schemas and client
│   │   └── utils/            # Server-side utilities (e.g., academicYear.ts)
│   ├── utils/                # Client-side utilities (e.g., key-stage-colors.ts)
│   └── index.ts              # Public library exports
├── routes/                   # SvelteKit file-based routing
│   ├── courses/             # Course list and detail pages
│   ├── courses/[id]/        # Course detail with modules list
│   ├── courses/[courseId]/modules/[moduleId]/  # Module editor with lessons
│   ├── classes/[id]/        # Dynamic route for individual class
│   ├── calendar/            # Calendar view with events
│   ├── settings/            # App settings (timetable, appearance)
│   ├── +layout.svelte       # Root layout
│   └── +page.svelte         # Dashboard homepage
├── app.d.ts                 # TypeScript app definitions
└── hooks.server.ts          # Server-side request handling
```

## Svelte MCP Server

You have access to the Svelte MCP server with comprehensive Svelte 5 and SvelteKit documentation:

### Available MCP Tools:

1. **list-sections**: ALWAYS use this FIRST to discover available documentation sections. Returns structured list with titles, use_cases, and paths.

2. **get-documentation**: Retrieves full documentation content for specific sections. After calling list-sections, analyze the use_cases field and fetch ALL relevant sections at once.

3. **svelte-autofixer**: Analyzes Svelte code and returns issues/suggestions. You MUST use this whenever writing Svelte code before sending to the user. Keep calling until no issues remain.

4. **playground-link**: Generates Svelte Playground link. Only use after asking user for confirmation and NEVER if code was written to files in the project.
