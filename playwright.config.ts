import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

/**
 * Minimal .env parser: KEY=VALUE per line, `#` comments, optional quotes.
 * We merge .env.local (base: Neon Auth, blob, etc.) with .env.test (overrides
 * DATABASE_URL to the isolated test branch). .env.test wins on conflict.
 */
function loadEnv(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const env: Record<string, string> = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

const env = { ...loadEnv('.env.local'), ...loadEnv('.env.test') };

// Safety: never run e2e (which truncates and writes data) against a database
// that is not the test branch. .env.test sets TEST_DB=1; production .env.local
// does not.
if (env.TEST_DB !== '1') {
	throw new Error(
		'Refusing to run e2e: TEST_DB is not "1". Create the test branch first with ' +
			'`bun run db:test:setup` (which writes .env.test). This guards against ' +
			'running destructive e2e tests against your production database.'
	);
}

export default defineConfig({
	// The test branch's Neon compute suspends when idle, so the first DB-backed
	// request after a cold start can take several seconds to wake. Give tests and
	// assertions enough headroom that a cold compute doesn't read as a failure.
	timeout: 60_000,
	expect: { timeout: 15_000 },
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			...env,
			ORIGIN: 'http://localhost:4173'
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
