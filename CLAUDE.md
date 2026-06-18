## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, mcp

## Keeping this file current

When something had to be pointed out by the user, or took real effort to
discover (a non-obvious workflow, tool, env quirk, or gotcha), record it here so
future sessions don't rediscover it. Keep entries to a line or two.

## Deployment & environment (Neon + Vercel)

Production runs on Vercel with a Neon Postgres + Neon Auth integration.

### Schema changes go through committed migrations — never hand-run SQL

The schema lives in `src/lib/server/db/schema.ts`. To change it:

1. Edit `schema.ts`.
2. Run `bun run db:generate` to record the change as a committed SQL migration
   under `drizzle/`.
3. Commit the generated `drizzle/` files alongside your code.

Deploys apply pending migrations automatically: `vercel.json` sets
`buildCommand` to `bun run db:migrate && bun run build`, so every Production and
Preview build brings its own Neon branch to the committed schema before the app
goes live. A failed migration fails the deploy (it never ships code against a
stale schema).

**Do NOT** hand-run `ALTER`/`CREATE` against branches, and **do NOT** use
`db:push` to change the schema — both reintroduce drift. All schema change is
`db:generate` + a committed migration. `scripts/reset-branch-to-migrations.ts`
is a one-time cutover / fresh-branch tool only, not a routine mechanism.

### Env-var names (cause production-only 500s)

The Neon–Vercel integration provisions different env-var names than local
conventions:

- Vercel Production provides `NEON_AUTH_BASE_URL` (not `NEON_AUTH_URL`) and
  `DATABASE_URL_UNPOOLED` (not always `DATABASE_URL`). The runtime client
  (`src/lib/server/db/index.ts`) and `drizzle.config.ts` both read
  `DATABASE_URL ?? DATABASE_URL_UNPOOLED`, so build-time migrate works on
  Production. Audit Production env vars against `.env.example`; `.env.local` is
  local-only and gitignored — it cannot reveal a Production env mismatch.

### Testing

- Unit tests (vitest): `bun run test:unit`. Pattern: extract pure logic into a
  module and test that (`src/lib/resources/copy.ts` ↔ `copy.spec.ts`); query
  functions in `src/lib/server/db` / `src/lib/server/queries` stay thin.
- **DB-backed behaviour is tested end-to-end against a real forked Neon branch**,
  not mocks. `bun run db:test:setup` forks a `test` branch from whatever
  `.env.local` points at, applies committed migrations, truncates it, and writes
  `.env.test` (gitignored, `TEST_DB=1`). Specs live in `e2e/*.e2e.ts` and run via
  `bun run test:e2e` (Playwright drives the built app against the test branch).
  e2e hits real Vercel Blob, so storage side-effects (uploads/deletes) are
  verifiable there — e.g. assert a deleted blob's URL now returns HTTP 404.
- Requires `NEON_API_KEY` in `.env.local`. The `TEST_DB=1` guard makes the reset
  refuse to run against any non-test database.

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
