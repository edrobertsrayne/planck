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
//    `public`; if the journal already records 0000 as applied, the migrate below
//    is a no-op even against the public schema we are about to empty.
await sql.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
console.log('dropped schema: drizzle (migration journal)');

// 2. Drop every table in `public` (app data). CASCADE is safe here because no
//    object outside `public` references these tables (app tables carry a plain
//    text user_id, not an FK into neon_auth.*), so identities are untouched.
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
//    which resolves DATABASE_URL ?? DATABASE_URL_UNPOOLED — we inject the explicit
//    target as DATABASE_URL here, so the unpooled fallback only matters on Vercel.
console.log('applying migrations…');
execFileSync('bunx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: url }
});

// 4. Sanity-check that the schema actually landed — the operator typically
//    points a live deployment at this branch next, so surface a quick signal
//    rather than trusting the migrate exit code alone.
const tableCount = (await sql`
	SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'
`) as { n: number }[];
const applied = (await sql`
	SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
`) as { n: number }[];
console.log(
	`\nBranch rebuilt from committed migrations: ${tableCount[0].n} public table(s), ` +
		`${applied[0].n} migration(s) applied.`
);
