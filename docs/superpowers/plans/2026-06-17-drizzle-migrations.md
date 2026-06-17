# Committed Drizzle Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc hand-run `ALTER` scripts with committed, versioned Drizzle migrations that deploy-time auto-apply, ending Neon branch schema drift.

**Architecture:** Commit a generated `0000` baseline of `src/lib/server/db/schema.ts` into `drizzle/`. A one-time reset script rebuilds each live Neon branch from that baseline (clean cutover — no real users yet). `vercel.json` runs `drizzle-kit migrate` before every build so prod and preview deploys self-apply pending migrations. The e2e test-branch setup also migrates so it can't drift.

**Tech Stack:** Drizzle ORM + drizzle-kit, Neon Postgres (`@neondatabase/serverless`), SvelteKit on Vercel, bun, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-17-drizzle-migrations-design.md`

---

## Key facts validated during design (do not re-litigate)

- `drizzle-kit migrate` auto-selects the `@neondatabase/serverless` **websocket** driver — no `pg`/`postgres` dependency needed. It is transactional, so each migration file applies atomically. (The `neon-http` no-transactions limit applies only to the app's runtime `db` client, not to `drizzle-kit migrate`.)
- The migration journal lives in schema **`drizzle`** (`drizzle.__drizzle_migrations`), **not** `public`. Any reset MUST drop the `drizzle` schema too, or the next migrate is a no-op against an empty DB.
- `bun.lock` exists → Vercel runs `bun`, so `bun run …` in `buildCommand` is valid. `drizzle-kit` is a devDependency and Vercel installs devDependencies during build.
- App tables use `text('user_id')` with no foreign key into `neon_auth`, so `DROP … CASCADE` on `public` cannot touch `neon_auth` identities.
- The `test` Neon branch is disposable (recreated by `bun run db:test:setup`); it is the safe target for end-to-end verification in this plan.

## File map

- **Modify** `drizzle.config.ts` — add `DATABASE_URL_UNPOOLED` fallback + explicit `out`.
- **Create** `drizzle/0000_baseline.sql` + `drizzle/meta/*` — committed baseline (generated, not hand-written).
- **Create** `scripts/reset-branch-to-migrations.ts` — one-time clean-cutover tool.
- **Create** `vercel.json` — deploy-time `buildCommand`.
- **Modify** `scripts/setup-test-branch.ts` — run `drizzle-kit migrate` on the test branch.
- **Delete** `scripts/sync-production-schema.ts` — superseded.
- **Modify** `CLAUDE.md` — document the migration workflow.
- **Modify** memory files (`db-push-scheduled-lesson-drift.md`, `additive-column-migration.md`, `neon-branch-topology-drift.md`, `MEMORY.md`) — retire superseded notes.

---

## Task 1: Add unpooled fallback + explicit out to drizzle.config.ts

**Files:**

- Modify: `drizzle.config.ts`

- [ ] **Step 1: Rewrite the config**

Replace the whole file with:

```typescript
import { defineConfig } from 'drizzle-kit';

// drizzle-kit (generate/migrate) shares the runtime client's URL resolution:
// Vercel Production only provisions DATABASE_URL_UNPOOLED, so fall back to it.
// See src/lib/server/db/index.ts for the matching runtime fallback.
const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('Neither DATABASE_URL nor DATABASE_URL_UNPOOLED is set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
```

- [ ] **Step 2: Verify it loads (offline check)**

Run: `bun run drizzle-kit --help`
Expected: prints drizzle-kit help with no "DATABASE_URL is not set" throw (bun auto-loads `.env.local`, which has `DATABASE_URL`).

- [ ] **Step 3: Commit**

```bash
git add drizzle.config.ts
git commit -m "chore(db): drizzle.config falls back to DATABASE_URL_UNPOOLED, sets out dir"
```

---

## Task 2: Generate and commit the baseline migration

**Files:**

- Create: `drizzle/0000_baseline.sql` (generated)
- Create: `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json` (generated)

- [ ] **Step 1: Generate the baseline**

Run: `bun run db:generate --name baseline`
Expected: prints a table summary and `Your SQL migration file ➜ drizzle/0000_baseline.sql`.

- [ ] **Step 2: Confirm the baseline contains the full schema**

Run: `grep -c '^CREATE TABLE' drizzle/0000_baseline.sql`
Expected: `11` (eleven app tables).

Run: `grep -c 'scheduled_lesson_user_id_class_id_date_period_unique' drizzle/0000_baseline.sql`
Expected: `1` (the constraint is present — it already exists on every live branch with zero duplicates, so the baseline matches reality).

- [ ] **Step 3: Confirm generate is now clean (no spurious diff)**

Run: `bun run db:generate`
Expected: `No schema changes, nothing to migrate` (or equivalent "no changes" message). No new file created under `drizzle/`.

- [ ] **Step 4: Commit the committed migration**

```bash
git add drizzle/
git commit -m "feat(db): commit baseline migration generated from schema.ts"
```

---

## Task 3: Create the clean-cutover reset script

**Files:**

- Create: `scripts/reset-branch-to-migrations.ts`

- [ ] **Step 1: Write the script**

Create `scripts/reset-branch-to-migrations.ts`:

```typescript
/**
 * One-time clean cutover to committed Drizzle migrations.
 *
 * Drops a Neon branch's app schema and the migration journal, then rebuilds it
 * from the committed migrations in drizzle/ via `drizzle-kit migrate`. Use this
 * to bring an existing, drifted branch to a known state ONCE, when adopting
 * migrations — NOT as a routine schema-change tool (that is `db:generate` +
 * deploy auto-migrate).
 *
 * The target connection string is passed EXPLICITLY as an argument; this script
 * never reads DATABASE_URL from the environment, so it cannot fire against the
 * wrong DB by accident.
 *
 * It is idempotent and re-runnable (every drop is IF EXISTS, in dependency-safe
 * order) — neon-http has no multi-statement transactions, so safety comes from
 * convergence on re-run, not atomicity.
 *
 *   bun scripts/reset-branch-to-migrations.ts "<connection string>"
 *
 * Get a branch's connection string with:
 *   bunx neonctl connection-string <branch> --project-id <id> --database-name neondb
 */
import { execFileSync } from 'node:child_process';
import { neon } from '@neondatabase/serverless';

const url = process.argv[2];
if (!url || !url.startsWith('postgres')) {
	throw new Error(
		'Pass the target branch connection string as the first argument:\n' +
			'  bun scripts/reset-branch-to-migrations.ts "postgresql://…"'
	);
}

const sql = neon(url);

// 1. Drop the migration journal first. It lives in the `drizzle` schema, NOT
//    `public`; without this, the migrate below is a no-op against an empty DB.
await sql.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
console.log('dropped schema: drizzle (migration journal)');

// 2. Drop every table in `public` (app data). neon_auth.* is left untouched —
//    app tables have no FK into it, so CASCADE here cannot affect identities.
const rows = (await sql`
	SELECT tablename FROM pg_tables WHERE schemaname = 'public'
`) as { tablename: string }[];
if (rows.length === 0) {
	console.log('no public tables to drop');
} else {
	const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
	await sql.query(`DROP TABLE IF EXISTS ${tables} CASCADE`);
	console.log(`dropped ${rows.length} public table(s): ${rows.map((r) => r.tablename).join(', ')}`);
}

// 3. Rebuild from committed migrations. drizzle-kit reads drizzle.config.ts,
//    which takes the URL from DATABASE_URL — set it to the explicit target only
//    for this child process.
console.log('applying migrations…');
execFileSync('bunx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: url }
});
console.log('\nBranch rebuilt from committed migrations.');
```

- [ ] **Step 2: Get the disposable test branch's connection string**

Run:

```bash
PID=$(grep -E '^NEON_PROJECT_ID' .env.local | cut -d= -f2- | tr -d '"')
export NEON_API_KEY=$(grep -E '^NEON_API_KEY' .env.local | cut -d= -f2- | tr -d '"')
bunx neonctl connection-string test --project-id "$PID" --database-name neondb --no-analytics
```

Expected: a `postgresql://…neon.tech/neondb?…` URL. Copy it for the next steps (referred to below as `<TEST_CS>`).

- [ ] **Step 3: Run the reset against the test branch**

Run: `bun scripts/reset-branch-to-migrations.ts "<TEST_CS>"`
Expected output includes: `dropped schema: drizzle`, `dropped 11 public table(s)`, `migrations applied successfully!`, `Branch rebuilt from committed migrations.`

- [ ] **Step 4: Verify the rebuilt state**

Create a throwaway `scripts/verify-branch.ts`:

```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.argv[2]);
const pub = (await sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`) as {
	n: number;
}[];
const jrn = (await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`) as {
	n: number;
}[];
console.log('public tables:', pub[0].n);
console.log('journal rows:', jrn[0].n);
```

Run: `bun scripts/verify-branch.ts "<TEST_CS>"`
Expected: `public tables: 11` and `journal rows: 1`.

Delete it afterward (it is a throwaway, not part of the deliverable):
`rm scripts/verify-branch.ts`

- [ ] **Step 5: Verify idempotency (re-run converges, does not brick)**

Run: `bun scripts/reset-branch-to-migrations.ts "<TEST_CS>"`
Expected: same success output; ends with `Branch rebuilt from committed migrations.` Re-run the Step 4 check → still `public tables: 11`, `journal rows: 1`.

- [ ] **Step 6: Commit**

```bash
git add scripts/reset-branch-to-migrations.ts
git commit -m "feat(db): add one-time reset-branch-to-migrations cutover script"
```

---

## Task 4: Add deploy-time auto-migrate via vercel.json

**Files:**

- Create: `vercel.json`

- [ ] **Step 1: Write vercel.json**

Create `vercel.json`:

```json
{
	"$schema": "https://openapi.vercel.sh/vercel.json",
	"buildCommand": "bun run db:migrate && bun run build"
}
```

- [ ] **Step 2: Verify the buildCommand locally (against the migrated test branch)**

Run: `DATABASE_URL="<TEST_CS>" bun run db:migrate`
Expected: `migrations applied successfully!` and, since the test branch is already at head, nothing new is applied (no errors). This proves the migrate half of the buildCommand runs cleanly; the `&& bun run build` half is the existing build.

> Note: the full local `bun run build` is not required here — it is unchanged behaviour. The deploy-time chain is exercised for real by the cutover runbook (Task 9) preview check.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(deploy): run drizzle-kit migrate before build on Vercel"
```

---

## Task 5: Migrate the test branch in setup-test-branch.ts

**Files:**

- Modify: `scripts/setup-test-branch.ts`

- [ ] **Step 1: Add a migrate step after writing .env.test, before emptying**

In `scripts/setup-test-branch.ts`, find the block that writes `.env.test` (step 4, the `writeFileSync('.env.test', …)` call) and the following "5. Empty the branch" block:

```typescript
console.log('Wrote .env.test pointing at the test branch.');

// 5. Empty the branch (it inherits the parent branch's data on creation).
console.log('Emptying the test branch…');
execFileSync('node', ['--env-file=.env.test', 'scripts/reset-test-db.ts'], { stdio: 'inherit' });
```

Replace it with:

```typescript
console.log('Wrote .env.test pointing at the test branch.');

// 5. Apply committed migrations so the test branch can't drift. It forks from
//    the branch .env.local points at, so this is usually a no-op — but if a
//    migration was committed after that branch was last migrated, this brings
//    the test branch to head deterministically rather than relying on the fork.
console.log('Applying committed migrations to the test branch…');
execFileSync('bunx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: connection }
});

// 6. Empty the branch (it inherits the parent branch's data on creation).
console.log('Emptying the test branch…');
execFileSync('node', ['--env-file=.env.test', 'scripts/reset-test-db.ts'], { stdio: 'inherit' });
```

(`connection` is the pooled connection string already computed in step 3 of the script.)

- [ ] **Step 2: Run the full test-branch setup end-to-end**

Run: `bun run db:test:setup`
Expected: logs `Applying committed migrations to the test branch…`, then `migrations applied successfully!`, then `Reset N table(s): pristine test database ready.`, then `Test branch ready.` Exit code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-test-branch.ts
git commit -m "feat(db): apply migrations in setup-test-branch so the test branch can't drift"
```

---

## Task 6: Delete the superseded sync script

**Files:**

- Delete: `scripts/sync-production-schema.ts`

- [ ] **Step 1: Confirm nothing references it**

Run: `grep -rn "sync-production-schema" --exclude-dir=node_modules --exclude-dir=.git .`
Expected: matches only in docs/specs/memory (prose), not in `package.json` or source.

- [ ] **Step 2: Delete and commit**

```bash
git rm scripts/sync-production-schema.ts
git commit -m "chore(db): retire sync-production-schema (superseded by committed migrations)"
```

---

## Task 7: Update CLAUDE.md to document the migration workflow

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Deployment & environment (Neon + Vercel)" section**

In `CLAUDE.md`, replace the entire `## Deployment & environment (Neon + Vercel)` section (from its heading down to the `---` separator before the Svelte MCP section) with:

```markdown
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
```

- [ ] **Step 2: Verify the section reads correctly**

Run: `sed -n '/## Deployment & environment/,/^---/p' CLAUDE.md`
Expected: prints the new section; no remaining mention of "ad-hoc `ALTER … IF NOT EXISTS` scripts" or `sync-production-schema.ts`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document committed-migration workflow in CLAUDE.md"
```

---

## Task 8: Retire superseded memory notes

**Files:**

- Modify: `/home/ed/.claude/projects/-home-ed-Projects-planck/memory/db-push-scheduled-lesson-drift.md`
- Modify: `/home/ed/.claude/projects/-home-ed-Projects-planck/memory/additive-column-migration.md`
- Modify: `/home/ed/.claude/projects/-home-ed-Projects-planck/memory/neon-branch-topology-drift.md`
- Modify: `/home/ed/.claude/projects/-home-ed-Projects-planck/memory/MEMORY.md`

> These files are outside the repo (no git commit step). Update them in place.

- [ ] **Step 1: Update `db-push-scheduled-lesson-drift.md`**

Append a clearly-marked superseded note to the body (keep the history, flag it as stale):

```markdown
---

**SUPERSEDED (2026-06-17):** As of the committed-migrations cutover (#14), all
branches carry `scheduled_lesson_user_id_class_id_date_period_unique` with zero
duplicate rows, and `drizzle-kit generate` produces a clean baseline. `db:push`
is retired for schema change — use `db:generate` + committed migrations. This
phantom-diff caveat no longer applies.
```

- [ ] **Step 2: Update `additive-column-migration.md`**

Append:

```markdown
---

**SUPERSEDED (2026-06-17):** Do not add columns via ad-hoc `ALTER` neon scripts
anymore. Edit `schema.ts`, run `bun run db:generate`, commit the migration;
deploy auto-applies it (#14).
```

- [ ] **Step 3: Update `neon-branch-topology-drift.md`**

Append:

```markdown
---

**UPDATED (2026-06-17):** Branch drift is now prevented by committed Drizzle
migrations applied at deploy time (`vercel.json` buildCommand) and in
`setup-test-branch.ts` (#14). To bring a drifted/fresh branch to the committed
schema, run `bun scripts/reset-branch-to-migrations.ts "<connection string>"`
(one-time cutover tool — `scripts/sync-production-schema.ts` was deleted).
```

- [ ] **Step 4: Update the two pointer lines in `MEMORY.md`**

In `MEMORY.md`, replace the `db-push scheduled_lesson drift` and
`Additive column migration` bullet lines with:

```markdown
- [db:push scheduled_lesson drift](db-push-scheduled-lesson-drift.md) — SUPERSEDED by committed migrations (#14); constraint now exists on all branches.
- [Additive column migration](additive-column-migration.md) — SUPERSEDED (#14); add columns via `schema.ts` + `db:generate`, not ad-hoc ALTER scripts.
```

And update the `Neon branch topology / drift` bullet to:

```markdown
- [Neon branch topology / drift](neon-branch-topology-drift.md) — drift now prevented by committed migrations auto-applied on deploy (#14); rebuild a branch with `scripts/reset-branch-to-migrations.ts`.
```

- [ ] **Step 5: Add a new memory for the migration workflow**

Create `/home/ed/.claude/projects/-home-ed-Projects-planck/memory/committed-migrations-workflow.md`:

```markdown
---
name: committed-migrations-workflow
description: Schema changes go through committed Drizzle migrations; deploys auto-apply them via vercel.json. No hand-run ALTER/db:push.
metadata:
  type: project
---

Since #14 (2026-06-17), DB schema change is: edit `src/lib/server/db/schema.ts`
→ `bun run db:generate` → commit the `drizzle/` SQL. Deploys auto-apply via
`vercel.json` `buildCommand` (`bun run db:migrate && bun run build`) against each
Neon branch. `drizzle-kit migrate` uses the `@neondatabase/serverless` websocket
driver (transactional, unlike the neon-http runtime client in
[[neon-http-no-transactions]]). The journal lives in schema `drizzle`, not
`public`.

**Why:** ends per-branch drift that caused prod-only 500s; documentation alone
didn't prevent it.

**How to apply:** never hand-run `ALTER`/`CREATE` or `db:push` to change schema.
To rebuild a drifted/fresh branch once, use
`scripts/reset-branch-to-migrations.ts`. Drift-check-in-CI is tracked in issue
#15. See [[neon-branch-topology-drift]] and [[database-url-unpooled-fallback]].
```

Then add to `MEMORY.md`:

```markdown
- [Committed migrations workflow](committed-migrations-workflow.md) — schema change = edit schema.ts + db:generate + commit; deploys auto-migrate (#14).
```

---

## Task 9: Cutover runbook (user-executed — destructive, order-sensitive)

> **This task is operational, not code. The user runs the destructive resets.**
> Sequencing is load-bearing: if the new `vercel.json` buildCommand reaches
> Production before the reset runs there, the build-time migrate hits a DB that
> has the 11 tables but no `drizzle` journal → `CREATE TABLE … already exists`
> → every deploy fails. Reset the live branches FIRST.

- [ ] **Step 1: Merge the branch carrying Tasks 1–8 to `main` but do NOT deploy yet**

Confirm the PR is approved and merged locally/remotely, but pause before the
Production deploy goes out (or the resets in Step 2 must precede the deploy
finishing its build). Practically: run Step 2 immediately, before/at the moment
of deploying.

- [ ] **Step 2: Reset Production and vercel-dev (user runs these)**

```bash
PID=$(grep -E '^NEON_PROJECT_ID' .env.local | cut -d= -f2- | tr -d '"')
export NEON_API_KEY=$(grep -E '^NEON_API_KEY' .env.local | cut -d= -f2- | tr -d '"')

# vercel-dev (your dev branch — its current data will be wiped; you accepted this)
DEV_CS=$(bunx neonctl connection-string vercel-dev --project-id "$PID" --database-name neondb --no-analytics)
bun scripts/reset-branch-to-migrations.ts "$DEV_CS"

# production (testing-only, no real users — data wiped, neon_auth identities kept)
PROD_CS=$(bunx neonctl connection-string production --project-id "$PID" --database-name neondb --no-analytics)
bun scripts/reset-branch-to-migrations.ts "$PROD_CS"
```

Expected for each: `dropped schema: drizzle`, `dropped N public table(s)`,
`migrations applied successfully!`, `Branch rebuilt from committed migrations.`

- [ ] **Step 3: Delete the stale preview branch**

```bash
bunx neonctl branches delete preview/fix/database-url-unpooled-fallback --project-id "$PID"
```

Expected: branch deleted (it re-forks clean from the now-migrated production on
the next preview deploy).

- [ ] **Step 4: Deploy Production and confirm it's healthy**

Let the merged `main` deploy to Vercel Production. In the Vercel build log,
confirm the build ran `bun run db:migrate` and it reported success (no
`already exists` error). Then log into the live app and load an authenticated
page — expect no 500.

- [ ] **Step 5: Preview build-time env verification (the gated acceptance check)**

Open a throwaway PR (e.g. a no-op README change) to trigger a Preview deploy.
In that preview's **build log**, confirm:

- `bun run db:migrate` ran during the build (not only at runtime), and
- it connected to the **preview's own** Neon branch (the integration injects the
  preview branch `DATABASE_URL_UNPOOLED` at build time), not Production, and did
  not error.

Load the preview URL and confirm authenticated pages work. Close the throwaway
PR. If migrate did NOT run at build time / lacked a DB URL, STOP and revisit the
fallback noted in the spec §3 before relying on preview auto-migrate.

---

## Self-review notes

- **Spec coverage:** baseline+config (Tasks 1–2), clean cutover script + ordered runbook (Tasks 3, 9), auto-migrate on deploy + preview gate (Tasks 4, 9 Step 5), test-branch migrate (Task 5), retire sync script (Task 6), CLAUDE.md (Task 7), memories (Task 8), CI drift-check out of scope → issue #15 (not a task here, by design). All spec acceptance criteria map to a task.
- **No `pg` dependency added** — validated that `drizzle-kit migrate` uses the already-installed `@neondatabase/serverless` driver.
- **Destructive steps** are isolated to Task 9 and explicitly user-run, with sequencing called out.
