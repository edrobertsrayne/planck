/**
 * Setup (and refresh) for the e2e test database.
 *
 * Creates a dedicated Neon branch named `test`, forked from the branch your
 * .env.local actually points at (so the schema always matches what your code
 * expects — the project's *default* branch may be stale), fetches its pooled
 * connection string, empties it, and writes .env.test.
 *
 * The `test` branch is deleted and recreated on every run, so re-running after a
 * schema change always gives you a fresh clone of the current schema.
 *
 * Run with bun so NEON_API_KEY is picked up from .env.local automatically:
 *
 *   bun run db:test:setup
 *
 * Requires NEON_API_KEY in .env.local (create one at
 * https://console.neon.tech/app/settings/api-keys). Optionally set
 * NEON_PROJECT_ID if your account has more than one project.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const TEST_BRANCH = 'test';
const DB_NAME = 'neondb';

if (!process.env.NEON_API_KEY) {
	throw new Error(
		'NEON_API_KEY is not set. Add it to .env.local (it is gitignored):\n' +
			'  NEON_API_KEY="<key from https://console.neon.tech/app/settings/api-keys>"'
	);
}

/** Run neonctl with JSON output and parse it. The CLI inherits NEON_API_KEY from the env. */
function neon<T = unknown>(args: string[]): T {
	const out = execFileSync('bunx', ['neonctl', ...args, '--output', 'json', '--no-analytics'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	});
	return JSON.parse(out) as T;
}

/** A branch's connection string. neonctl prints the raw URI (not JSON) by default. */
function connectionString(branch: string, projectId: string, pooled: boolean): string {
	const args = [
		'neonctl',
		'connection-string',
		branch,
		'--project-id',
		projectId,
		'--database-name',
		DB_NAME,
		'--no-analytics'
	];
	if (pooled) args.push('--pooled');
	const raw = execFileSync('bunx', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	}).trim();
	const cs = raw.startsWith('{')
		? ((JSON.parse(raw) as { connection_string?: string; uri?: string }).connection_string ??
			(JSON.parse(raw) as { uri?: string }).uri ??
			'')
		: raw;
	if (!cs.startsWith('postgres'))
		throw new Error(`Unexpected connection string from neonctl:\n${raw}`);
	return cs;
}

/** The Neon endpoint id (ep-xxxx, without the -pooler suffix) from a connection string. */
function endpointId(url: string): string | undefined {
	const m = url.match(/ep-[a-z0-9-]+/);
	return m ? m[0].replace(/-pooler$/, '') : undefined;
}

/**
 * Find the branch whose endpoint matches .env.local's DATABASE_URL — that is the
 * branch your app runs against, and the one with the current schema. Forking the
 * test branch from it keeps the e2e schema in lockstep with local development.
 */
function resolveParentBranch(projectId: string, branches: { name: string }[]): string | undefined {
	if (!existsSync('.env.local')) return undefined;
	const m = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=["']?([^"'\n]+)/m);
	const localEndpoint = m && endpointId(m[1]);
	if (!localEndpoint) return undefined;
	for (const b of branches) {
		if (b.name === TEST_BRANCH) continue;
		try {
			if (endpointId(connectionString(b.name, projectId, false)) === localEndpoint) return b.name;
		} catch {
			// Branch without a reachable compute — skip it.
		}
	}
	return undefined;
}

// 1. Resolve the project id.
let projectId = process.env.NEON_PROJECT_ID;
if (!projectId) {
	const projects = neon<{ id: string; name: string }[]>(['projects', 'list']);
	const list = Array.isArray(projects)
		? projects
		: ((projects as { projects?: { id: string; name: string }[] }).projects ?? []);
	if (list.length === 1) {
		projectId = list[0].id;
	} else {
		const names = list.map((p) => `  ${p.id}  ${p.name}`).join('\n');
		throw new Error(
			`Found ${list.length} Neon projects. Set NEON_PROJECT_ID in .env.local to one of:\n${names}`
		);
	}
}
console.log(`Using Neon project ${projectId}.`);

// 2. (Re)create the `test` branch, forked from the branch .env.local uses.
const branchesRaw = neon<unknown>(['branches', 'list', '--project-id', projectId]);
const branches = (
	Array.isArray(branchesRaw)
		? branchesRaw
		: ((branchesRaw as { branches?: { name: string }[] }).branches ?? [])
) as { name: string }[];

const parent = resolveParentBranch(projectId, branches);
if (parent) {
	console.log(`Forking from "${parent}" (the branch .env.local points at).`);
} else {
	console.warn(
		'WARNING: could not match .env.local to a branch — forking from the default ' +
			'branch, whose schema may be stale. Check the e2e schema if tests fail.'
	);
}

if (branches.some((b) => b.name === TEST_BRANCH)) {
	console.log(`Removing the existing "${TEST_BRANCH}" branch so it is recreated fresh…`);
	neon(['branches', 'delete', TEST_BRANCH, '--project-id', projectId]);
}

console.log(`Creating branch "${TEST_BRANCH}"…`);
const createArgs = ['branches', 'create', '--project-id', projectId, '--name', TEST_BRANCH];
if (parent) createArgs.push('--parent', parent);
neon(createArgs);

// 3. Fetch the pooled connection string for the test branch.
const connection = connectionString(TEST_BRANCH, projectId, true);

// 4. Write .env.test (gitignored).
writeFileSync(
	'.env.test',
	[
		'# Generated by scripts/setup-test-branch.ts — do NOT commit (gitignored).',
		'# Connection string for the dedicated Neon `test` branch.',
		`DATABASE_URL="${connection}"`,
		'',
		'# Guard flag: scripts/reset-test-db.ts refuses to run unless this is set,',
		'# and playwright.config.ts refuses to start e2e against a DB without it.',
		'TEST_DB=1',
		'',
		'# Shared secret so the reaper e2e can authenticate against the cron endpoint.',
		'CRON_SECRET="e2e-cron-secret"',
		''
	].join('\n')
);
console.log('Wrote .env.test pointing at the test branch.');

// 5. Apply committed migrations so the test branch can't drift. It forks from
//    the branch .env.local points at, so this is usually a no-op — but if a
//    migration was committed after that branch was last migrated, this brings
//    the test branch to head deterministically rather than relying on the fork.
//    Use the direct (unpooled) endpoint for DDL — the pooled endpoint exists for
//    the app's runtime queries, not schema migration.
console.log('Applying committed migrations to the test branch…');
const directConnection = connectionString(TEST_BRANCH, projectId, false);
execFileSync('bunx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: { ...process.env, DATABASE_URL: directConnection }
});

// 6. Empty the branch (it inherits the parent branch's data on creation).
console.log('Emptying the test branch…');
execFileSync('node', ['--env-file=.env.test', 'scripts/reset-test-db.ts'], { stdio: 'inherit' });

console.log('\nTest branch ready. Run `bun run test:e2e` to use it.');
