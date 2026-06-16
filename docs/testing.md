# Testing

## Test layers

- **Unit / component** (`*.spec.ts`, `*.svelte.test.ts`) — pure logic and
  component behaviour. These do **not** touch the database, so they need no
  special setup: `bun run test:unit`.
- **End-to-end** (`e2e/*.e2e.ts`) — Playwright drives a real build + preview
  server against a real Neon Postgres database. These run against a dedicated,
  isolated **test branch**, never production.

## The e2e test database

e2e tests sign up, write, and delete real rows. To keep that off the production
database, we use a dedicated [Neon branch](https://neon.tech/docs/introduction/branching)
named `test` — a copy-on-write clone of the default branch with the same schema
but isolated data.

### One-time setup

1. Create a Neon API key at
   <https://console.neon.tech/app/settings/api-keys> and add it to `.env.local`
   (gitignored):

   ```
   NEON_API_KEY="<your key>"
   ```

   If your account has more than one project, also set `NEON_PROJECT_ID`.

2. Create the branch and generate `.env.test`:

   ```
   bun run db:test:setup
   ```

   This forks the `test` branch from **the branch your `.env.local` points at**
   (not the project's default branch, which may carry a stale schema), fetches
   its pooled connection string, empties it, and writes `.env.test`. The branch
   is deleted and recreated on every run, so re-running after a schema change
   always gives a fresh clone of the current schema.

   > Schema is applied to branches by manual `ALTER` scripts, not migrations, and
   > those may only have reached the branch you develop against — so the test
   > branch must be forked from that branch to match what the code expects.

### Running e2e

```
bun run test:e2e     # resets the test DB, then runs Playwright
bun run test         # unit tests, then e2e
```

`test:e2e` first runs `db:test:reset`, which **truncates every table** in the
test branch so each run starts pristine and deterministic. Playwright's preview
server is pointed at the test branch via `.env.test` (merged over `.env.local`
for the Neon Auth / blob config).

### Safety guards

Two independent checks prevent the destructive reset from ever hitting
production:

- `.env.test` sets `TEST_DB=1`. `scripts/reset-test-db.ts` refuses to truncate
  unless that flag is present, and it is loaded with `node --env-file=.env.test`
  so the production `DATABASE_URL` in `.env.local` is never in scope.
- `playwright.config.ts` refuses to start the e2e suite unless the merged env
  has `TEST_DB=1`.

> **Note on auth identities:** Neon Auth users live in the `neon_auth` schema,
> which the reset does not touch. e2e specs use unique timestamped emails, so
> leftover identities never collide — only `public` app data is reset.
