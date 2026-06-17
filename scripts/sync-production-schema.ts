/**
 * One-off, idempotent migration: bring a drifted branch up to the current
 * schema in src/lib/server/db/schema.ts.
 *
 * The Neon `production` (primary/default) branch predates several additive
 * changes that were only ever applied to the `vercel-dev` branch (which
 * .env.local points at). As a result the live Vercel production deployment
 * 500s on the first post-login query (SELECT class.colour ...). This script
 * adds the missing tables/columns. Everything is additive and guarded, so it
 * is safe to re-run and never touches existing data.
 *
 * Run against the production branch (get its URL from the Neon console or:
 *   bunx neonctl connection-string production --project-id <id> --database-name neondb --pooled
 * ):
 *
 *   DATABASE_URL="<production branch connection string>" bun run scripts/sync-production-schema.ts
 *
 * Safe to re-run (every statement is IF [NOT] EXISTS).
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const sql = neon(url);

// Each entry is one complete SQL statement (neon-http has no multi-statement
// or interactive transactions — run them one at a time).
const statements: string[] = [
	// --- Additive columns (added 2026-06-16, commit 71c8293) ---
	`ALTER TABLE closure_day      ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''`,
	`ALTER TABLE module           ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''`,
	`ALTER TABLE lesson           ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''`,
	`ALTER TABLE class            ADD COLUMN IF NOT EXISTS colour text NOT NULL DEFAULT '#8775c6'`,
	`ALTER TABLE scheduled_lesson ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''`,
	`ALTER TABLE scheduled_lesson ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false`,
	`ALTER TABLE scheduled_lesson ADD COLUMN IF NOT EXISTS postponed boolean NOT NULL DEFAULT false`,

	// --- Resources feature tables (missing entirely on the stale branch) ---
	`CREATE TABLE IF NOT EXISTS resource_link (
		id serial PRIMARY KEY,
		user_id text NOT NULL,
		lesson_id integer REFERENCES lesson(id) ON DELETE CASCADE,
		scheduled_lesson_id integer REFERENCES scheduled_lesson(id) ON DELETE CASCADE,
		course_id integer REFERENCES course(id) ON DELETE CASCADE,
		module_id integer REFERENCES module(id) ON DELETE CASCADE,
		url text NOT NULL,
		label text,
		order_index integer NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS resource_file (
		id serial PRIMARY KEY,
		user_id text NOT NULL,
		lesson_id integer REFERENCES lesson(id) ON DELETE CASCADE,
		scheduled_lesson_id integer REFERENCES scheduled_lesson(id) ON DELETE CASCADE,
		course_id integer REFERENCES course(id) ON DELETE CASCADE,
		module_id integer REFERENCES module(id) ON DELETE CASCADE,
		blob_url text NOT NULL,
		pathname text NOT NULL,
		filename text NOT NULL,
		content_type text NOT NULL,
		size integer NOT NULL,
		order_index integer NOT NULL DEFAULT 0
	)`
];

for (const statement of statements) {
	await sql.query(statement);
	console.log('ok:', statement.split('\n')[0].trim());
}

// Verify nothing is still missing against the expected shape.
const expected: Record<string, string[]> = {
	closure_day: ['name'],
	module: ['description'],
	lesson: ['note'],
	class: ['colour'],
	scheduled_lesson: ['note', 'done', 'postponed'],
	resource_link: ['id', 'user_id', 'url'],
	resource_file: ['id', 'user_id', 'pathname']
};
const rows = (await sql`
	SELECT table_name, column_name FROM information_schema.columns
	WHERE table_schema = 'public'`) as { table_name: string; column_name: string }[];
const have = new Map<string, Set<string>>();
for (const r of rows) {
	if (!have.has(r.table_name)) have.set(r.table_name, new Set());
	have.get(r.table_name)!.add(r.column_name);
}
const missing: string[] = [];
for (const [table, cols] of Object.entries(expected)) {
	const present = have.get(table);
	if (!present) {
		missing.push(`${table} (table)`);
		continue;
	}
	for (const c of cols) if (!present.has(c)) missing.push(`${table}.${c}`);
}
console.log(missing.length ? `\nSTILL MISSING: ${missing.join(', ')}` : '\nVerified: schema is in sync.');
