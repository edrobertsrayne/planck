/**
 * Reset the test database to a pristine state: truncate every table in the
 * `public` schema. Run before each e2e run so tests never accrete data.
 *
 * Safety: refuses to run unless TEST_DB === '1'. Only .env.test sets that flag,
 * so this can never fire against the production database in .env.local. Always
 * invoke with the test env loaded exclusively, e.g.
 *
 *   node --env-file=.env.test scripts/reset-test-db.ts
 *
 * `node --env-file` loads only the named file (unlike bun, which also auto-loads
 * .env.local), so the production DATABASE_URL is never in scope here.
 */
import { neon } from '@neondatabase/serverless';

if (process.env.TEST_DB !== '1') {
	throw new Error(
		'Refusing to reset: TEST_DB is not "1". This guards against truncating a ' +
			'non-test database. Run with `node --env-file=.env.test scripts/reset-test-db.ts`.'
	);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (expected it in .env.test).');

const sql = neon(url);

// Discover tables dynamically so new schema tables are covered automatically.
// Neon Auth's user store lives in its own schema (neon_auth.*), so truncating
// `public` clears app data while leaving auth identities untouched — e2e tests
// use unique timestamped emails, so leftover identities never collide.
const rows = (await sql`
	SELECT tablename FROM pg_tables WHERE schemaname = 'public'
`) as { tablename: string }[];

if (rows.length === 0) {
	console.log('No tables in the public schema; nothing to reset.');
} else {
	const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
	await sql.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
	console.log(`Reset ${rows.length} table(s): pristine test database ready.`);
}
