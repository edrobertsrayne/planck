# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Planck is a lesson planning and scheduling tool for UK secondary Physics teachers.

## Tech Stack (Source of Truth)

This section is the single source of truth for the project's technology choices.

| Layer          | Technology              | Documentation                    |
| -------------- | ----------------------- | -------------------------------- |
| Framework      | SvelteKit with Svelte 5 | https://svelte.dev/docs          |
| UI Components  | shadcn-svelte           | https://www.shadcn-svelte.com/   |
| Styling        | Tailwind CSS v4         | https://tailwindcss.com/docs     |
| Database       | SQLite with Drizzle ORM | https://orm.drizzle.team/docs    |
| Authentication | Better Auth             | https://www.better-auth.com/docs |
| Runtime        | Bun                     | https://bun.sh/docs              |

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
```

## Testing Architecture

Vitest is configured with two separate test projects to handle different testing contexts:

1. **Client tests** (`*.svelte.test.ts` or `*.svelte.spec.ts`): Run in browser using Playwright/Chromium for testing Svelte components
2. **Server tests** (`*.test.ts` or `*.spec.ts` excluding svelte files): Run in Node.js environment for testing server-side code

Tests in `src/lib/server/**` are automatically excluded from browser tests.

## Database Management

The project uses Drizzle ORM with better-sqlite3 (`drizzle-orm/better-sqlite3`). Database configuration is in `drizzle.config.ts`:

- Schema location: `src/lib/server/db/schema.ts`
- Additional auth schema: `src/lib/server/db/auth.schema.ts`
- Database client: `src/lib/server/db/index.ts`

The database client uses `better-sqlite3` which provides a synchronous API with `client.exec()` for executing SQL statements.

Database URL must be set in `.env` as `DATABASE_URL` (defaults to `local.db` for local development).

## Authentication Architecture

Better Auth is integrated with SvelteKit:

- **Auth instance**: `src/lib/server/auth.ts` - Uses Drizzle adapter with SQLite and email/password authentication
- **Server hooks**: `src/hooks.server.ts` - Injects session/user into `event.locals` for all requests
- **Type definitions**: `src/app.d.ts` - Defines `App.Locals` with optional `user` and `session` properties
- **Demo routes**: `src/routes/demo/better-auth/` - Example authentication implementation

The auth system requires `ORIGIN` and `BETTER_AUTH_SECRET` environment variables (see `.env.example`).

## Environment Configuration

Required environment variables (see `.env.example`):

- `DATABASE_URL`: SQLite database file path
- `ORIGIN`: Base URL for Better Auth
- `BETTER_AUTH_SECRET`: 32-character high-entropy secret for production

## Project Structure

```
src/
├── lib/
│   ├── assets/           # Static assets
│   ├── server/
│   │   ├── db/          # Database schemas and client
│   │   └── auth.ts      # Better Auth configuration
│   └── index.ts         # Public library exports
├── routes/              # SvelteKit file-based routing
│   ├── demo/           # Demo pages (e.g., authentication)
│   ├── +layout.svelte  # Root layout
│   └── +page.svelte    # Homepage
├── app.d.ts            # TypeScript app definitions
└── hooks.server.ts     # Server-side request handling
```

## Svelte MCP Server

You have access to the Svelte MCP server with comprehensive Svelte 5 and SvelteKit documentation:

### Available MCP Tools:

1. **list-sections**: ALWAYS use this FIRST to discover available documentation sections. Returns structured list with titles, use_cases, and paths.

2. **get-documentation**: Retrieves full documentation content for specific sections. After calling list-sections, analyze the use_cases field and fetch ALL relevant sections at once.

3. **svelte-autofixer**: Analyzes Svelte code and returns issues/suggestions. You MUST use this whenever writing Svelte code before sending to the user. Keep calling until no issues remain.

4. **playground-link**: Generates Svelte Playground link. Only use after asking user for confirmation and NEVER if code was written to files in the project.
