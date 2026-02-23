import * as schema from './schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { PgliteDatabase } from 'drizzle-orm/pglite';

let _db: NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

if (process.env.VITEST) {
	// Safety guard: tests must use PGlite, never a real database
	const { PGlite } = await import('@electric-sql/pglite');
	const { drizzle } = await import('drizzle-orm/pglite');
	const { migrate } = await import('drizzle-orm/pglite/migrator');

	const client = new PGlite();
	const testDb = drizzle(client, { schema });
	await migrate(testDb, { migrationsFolder: './drizzle' });
	_db = testDb;
} else {
	const { neon } = await import('@neondatabase/serverless');
	const { drizzle } = await import('drizzle-orm/neon-http');
	const { env } = await import('$env/dynamic/private');

	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

	const sql = neon(env.DATABASE_URL);
	_db = drizzle({ client: sql, schema });
}

export const db = _db;
