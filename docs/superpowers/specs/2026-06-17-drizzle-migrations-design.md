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
  branch and rebuild it from the committed `0000` baseline via `drizzle-kit
  migrate`. (`neon_auth.*` identities are left untouched.)
- **Deploy-time migrate via `vercel.json` `buildCommand`** (not the local
  `build` script), so local builds don't migrate the dev branch.
- **Reset script drops the `public` schema's tables AND the `drizzle` schema**
  (see "Empirically validated" below — the journal lives in `drizzle`, not
  `public`); the target connection string is passed explicitly as an argument
  (no env auto-read) as the natural guard against hitting the wrong DB. The
  reset is idempotent and re-runnable, **not** transactional.

## Empirically validated (2026-06-17, against the disposable `test` branch)

Ran the full cutover flow end-to-end before finalizing this spec:

- **`drizzle-kit migrate` connects via the `@neondatabase/serverless` websocket
  driver automatically** — no `pg`/`postgres` dependency is needed or installed,
  and it reaches Neon fine. (The websocket driver *is* transactional, unlike the
  `neon-http` runtime driver, so each migration file applies atomically.)
- **The migration journal lives in schema `drizzle`** (`drizzle.__drizzle_migrations`),
  **not `public`.** Consequence: dropping only `public` and re-running migrate is
  a **no-op that leaves an empty DB** (0 tables, journal still says `0000`
  applied). The reset script **must** also `DROP SCHEMA drizzle CASCADE`.
  Verified: drop-public-only + migrate → 0 tables; drop-`drizzle`-too + migrate →
  schema rebuilt correctly.
- **`bun.lock` is present**, so Vercel runs `bun`; `bun run db:migrate` in
  `buildCommand` is valid.
- App tables use `text('user_id')` (no cross-schema FK to `neon_auth`), so
  `DROP … CASCADE` on `public` cannot affect `neon_auth`.

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
- **Idempotent and re-runnable, not transactional.** Drops in a dependency-safe
  order with `IF EXISTS`, so re-running from any partial state converges:
  1. `DROP SCHEMA IF EXISTS drizzle CASCADE` (the migration journal — without
     this, the next migrate is a no-op and leaves an empty DB).
  2. Every table in the `public` schema via `DROP TABLE IF EXISTS … CASCADE`,
     discovered dynamically from `pg_tables` (same enumeration pattern as
     `reset-test-db.ts`). Leaves `neon_auth.*` alone.
- Then runs `drizzle-kit migrate` against that branch (override `DATABASE_URL`
  for the migrate invocation) to rebuild from `0000`.
- Prints a summary of what it dropped and which migration(s) it applied.
- The drops run over `neon-http` (non-transactional); that's why the script is
  designed to be safely re-run rather than relying on atomicity.

Operationally, run it against `production` and `vercel-dev`, and delete the
stale `preview/fix/database-url-unpooled-fallback` branch (it will re-fork clean
from the now-migrated production on the next preview deploy). After this, every
branch's DB equals the committed baseline and carries the journal table.

### 2a. Cutover runbook (ordered — sequencing is load-bearing)

The reset and the `buildCommand` change are order-sensitive. If the new
`buildCommand` goes live on Production **before** the reset has run there, the
build-time migrate tries to apply `0000` against a DB that has all 11 tables but
no `drizzle` journal → `CREATE TABLE … "already exists"` → **every deploy
fails**. Execute in this order:

1. Land the migration files (`drizzle/`) and config changes, **and** run
   `reset-branch-to-migrations.ts` against **`production`** and **`vercel-dev`**
   (creates the `drizzle` journal; rebuilds tables from `0000`) — the resets run
   against the live branches *before* the new build command executes.
2. *Then* ship the deploy carrying `vercel.json`; its build-time migrate now
   sees the journal and no-ops.

The user runs the destructive resets (against `production` + `vercel-dev`)
during plan execution.

### 3. Auto-migrate on deploy

Add `vercel.json`:

```json
{
  "buildCommand": "bun run db:migrate && bun run build"
}
```

- Migrate runs before the app builds on every deploy (prod + preview). A failed
  migration **fails the deploy** rather than shipping code against a stale
  schema. This stays fatal — never `|| true`.
- Preview branches fork from the migrated production, inherit the journal, and
  apply only *new* migrations.
- `drizzle-kit migrate` connects via the `@neondatabase/serverless` websocket
  driver (validated above), which is transactional, so the `neon-http`
  no-interactive-transactions limitation does **not** apply here. Each migration
  file applies atomically.
- `drizzle-kit` is a devDependency; Vercel installs devDependencies during
  build, so it is available.

**Preview build-time env is gated on verification (not assumed).** The design
assumes the Neon–Vercel integration injects the per-preview branch's
`DATABASE_URL_UNPOOLED` at *build* time (not only runtime). This is external
Vercel/Neon behavior that can't be verified from the repo. Acceptance therefore
includes a one-time check: after cutover, open a throwaway preview PR and
confirm its **build log** shows migrate connecting to the *preview* branch (not
Production, not a failure). Only if that check fails do we consider a runtime/
once fallback — we do **not** build one pre-emptively (YAGNI).

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
- [ ] **Verified on a throwaway preview PR**: build-time migrate connects to the
      preview's own Neon branch (build-log check; see §3).
- [ ] `setup-test-branch.ts` applies migrations so the test branch can't drift.
- [ ] CLAUDE.md updated to point at the migration workflow.

## Out of scope

- Already-shipped env-var fixes (#12, #13) and the one-off production sync.
- The older one-off data scripts (`backfill-order-index.ts`,
  `migrate-resource-rename.ts`) — already applied; left as historical artifacts.
- **CI guard that fails when committed migrations don't match `schema.ts`** —
  split out to **issue #15** (no CI workflow exists in this repo yet; standing
  one up is its own piece of work). Committed migrations stop *branch* drift;
  the CI check is the additive guard against *schema-vs-migrations* drift.
