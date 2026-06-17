## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, mcp

## Deployment & environment (Neon + Vercel)

Production runs on Vercel with a Neon Postgres + Neon Auth integration. The
integration's provisioned env-var names differ from local conventions, and have
caused production-only 500s. If prod 500s but local works, check these first:

- **Env var names.** Vercel Production provides `NEON_AUTH_BASE_URL` (not
  `NEON_AUTH_URL`) and `DATABASE_URL_UNPOOLED` (not always `DATABASE_URL`). The
  code reads the integration's names / falls back to them. `.env.local` is
  local-only and gitignored — it cannot reveal or prevent a Production env
  mismatch. Audit Production env vars against `.env.example`.
- **Neon branch schema drift.** Schema is applied via ad-hoc `ALTER … IF NOT
  EXISTS` scripts, not committed migrations. The Neon `production` (default)
  branch can lag the `vercel-dev` branch that `.env.local` uses; preview
  branches fork from `production` and inherit any staleness. Sync a branch with
  `scripts/sync-production-schema.ts`.

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
