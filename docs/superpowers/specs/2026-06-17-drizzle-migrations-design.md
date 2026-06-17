# Committed Drizzle migrations to stop Neon branch schema drift

**Issue:** #14
**Date:** 2026-06-17
**Status:** Approved — ready for implementation plan

## Problem

Schema changes are applied as ad-hoc, hand-run `ALTER … ADD COLUMN IF NOT
EXISTS` scripts against whichever Neon branch is targeted, with **no committed
migrations**. `schema.ts` is the only source of truth. Branches silently
diverge: the `production` (default) branch lagged `vercel-dev`; preview branches
fork from `production` and inherit the staleness, 500'ing post-login. There is
no deterministic way to bring a fresh branch to a known schema.

## Investigation findings (2026-06-17)

Queried all four live branches (`vercel-dev`, `production`, `test`,
`preview/fix/database-url-unpooled-fallback`):

- **All four already carry** the `scheduled_lesson_user_id_class_id_date_period_unique`
  constraint, with **zero duplicate rows**. The "phantom diff" recorded in
  memory is stale — it was a `db:push` introspection quirk. A real
  `drizzle-kit generate` produces a clean baseline (`0000_baseline.sql`) that
  matches reality, constraint included. **We keep the constraint in `schema.ts`
  as-is; no dedupe is needed.**
- **No `drizzle/` directory exists.** `db:generate` / `db:migrate` scripts are
  wired in `package.json` but have never produced output.
- **`drizzle.config.ts` hard-requires `DATABASE_URL`** and does not fall back to
  `DATABASE_URL_UNPOOLED` (the only DB name Vercel Production provides).
- **There are no real users** — the production DB is for testing only. This
  permits a clean cutover: reset all branches rather than baseline-stamp them.

## Decisions

- **Clean cutover, not stamping.** Because there are no real users, reset every
  branch's `public` schema and rebuild it from the committed `0000` baseline via
  `drizzle-kit migrate`. (`neon_auth.*` identities are left untouched.)
- **Deploy-time migrate via `vercel.json` `buildCommand`** (not the local
  `build` script), so local builds don't migrate the dev branch.
- **Reset script drops `public` tables only** (matching `reset-test-db.ts`
  convention); the target connection string is passed explicitly as an argument
  (no env auto-read) as the natural guard against hitting the wrong DB.

## Design

### 1. Baseline migration + config

- Run `bun run db:generate` to commit `drizzle/0000_baseline.sql` and
  `drizzle/meta/`. This is the full current `schema.ts`, verified clean.
- Update `drizzle.config.ts`:
  - Set `out: './drizzle'` explicitly.
  - Read the URL as `process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED`,
    mirroring `src/lib/server/db/index.ts`, so build-time migrate works on
    Production (unpooled-only).

### 2. Clean cutover for existing branches

New one-time `scripts/reset-branch-to-migrations.ts`:

- Takes the target connection string as an explicit CLI argument (does **not**
  auto-read `DATABASE_URL` from the environment).
- Drops every table in the `public` schema (including any stray
  `__drizzle_migrations`) via `DROP TABLE … CASCADE`, discovered dynamically
  from `pg_tables` (same enumeration pattern as `reset-test-db.ts`). Leaves
  `neon_auth.*` alone.
- Then runs `drizzle-kit migrate` against that branch (override `DATABASE_URL`
  for the migrate invocation) to rebuild from `0000`.
- Prints a summary of what it dropped and which migration(s) it applied.

Operationally, run it against `production` and `vercel-dev`, and delete the
stale `preview/fix/database-url-unpooled-fallback` branch (it will re-fork clean
from the now-migrated production on the next preview deploy). After this, every
branch's DB equals the committed baseline and carries the journal table.

### 3. Auto-migrate on deploy

Add `vercel.json`:

```json
{
  "buildCommand": "bun run db:migrate && bun run build"
}
```

- Migrate runs before the app builds on every deploy (prod + preview). A failed
  migration fails the deploy rather than shipping code against a stale schema.
- Preview branches fork from the migrated production, inherit the journal, and
  apply only *new* migrations.
- `drizzle-kit migrate` opens its own TCP connection (via the postgres driver),
  so the `neon-http` no-interactive-transactions limitation does **not** apply
  here. Migrations may use transactions normally.
- `drizzle-kit` is a devDependency; Vercel installs devDependencies during
  build, so it is available.

### 4. Test branch can't drift

`scripts/setup-test-branch.ts` already forks `test` from the branch `.env.local`
points at (`vercel-dev`, now migrated). Add a `drizzle-kit migrate` call against
the freshly created test branch (after the `.env.test` write / reset step), so
it deterministically applies any committed-but-not-yet-forked migrations rather
than relying solely on the fork inheriting them.

### 5. Retire ad-hoc scripts & update docs

- Delete `scripts/sync-production-schema.ts` (superseded by `0000` + migrate).
- **Update `CLAUDE.md` to make committed migrations the documented, mandatory
  way to change the schema going forward.** This is a required deliverable, not
  optional polish. Rewrite the "Deployment & environment (Neon + Vercel)"
  section so it:
  - States the workflow plainly: edit `schema.ts` → `bun run db:generate` →
    commit the generated SQL in `drizzle/` → deploy auto-applies pending
    migrations via the `vercel.json` `buildCommand`.
  - Removes the "Schema is applied via ad-hoc `ALTER … IF NOT EXISTS` scripts,
    not committed migrations" framing and the instruction to sync a branch with
    `scripts/sync-production-schema.ts` (that script is deleted).
  - Explicitly says **not** to hand-run `ALTER`/`db:push` against branches to
    change schema; all schema change goes through `db:generate` + a committed
    migration.
  - Keeps the env-var guidance (`NEON_AUTH_BASE_URL`, `DATABASE_URL_UNPOOLED`)
    and notes that `drizzle.config.ts` shares the same `DATABASE_URL ??
    DATABASE_URL_UNPOOLED` fallback so deploy-time migrate works on Production.
  - Points at `scripts/reset-branch-to-migrations.ts` as the one-time / fresh
    cutover tool, not a routine schema-change mechanism.
- Update memories: mark the phantom-diff note (`db-push-scheduled-lesson-drift`)
  as resolved/stale, and revise the branch-drift note
  (`neon-branch-topology-drift`) to point at the migration workflow.

## Future workflow

Edit `schema.ts` → `bun run db:generate` → commit the generated SQL → deploy
auto-applies pending migrations. No hand-run ALTERs; no per-branch divergence.

## Acceptance criteria (from issue #14)

- [x] `drizzle/` contains committed migrations; `db:generate` produces no
      spurious diff (phantom `scheduled_lesson` diff confirmed non-existent).
- [ ] A fresh Neon branch reaches the current schema with one deterministic
      command (`drizzle-kit migrate`).
- [ ] Production and preview deploys apply pending migrations automatically
      (`vercel.json` buildCommand).
- [ ] `setup-test-branch.ts` applies migrations so the test branch can't drift.
- [ ] CLAUDE.md updated to point at the migration workflow.

## Out of scope

- Already-shipped env-var fixes (#12, #13) and the one-off production sync.
- The older one-off data scripts (`backfill-order-index.ts`,
  `migrate-resource-rename.ts`) — already applied; left as historical artifacts.
