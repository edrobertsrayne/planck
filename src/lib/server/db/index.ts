import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Build the connection lazily, on first use. SvelteKit's build-time `analyse`
// step imports every server module, and env vars aren't injected then — so
// constructing the client (or throwing on a missing URL) at import time breaks
// the build. By deferring to first access we only need the URL at runtime.
let instance: Db | undefined;
function resolve(): Db {
	if (!instance) {
		// The Neon–Vercel integration provisions DATABASE_URL_UNPOOLED and does not
		// always set DATABASE_URL (e.g. Production only had the unpooled name) — so
		// fall back to it. neon-http issues one-shot HTTP queries, so the unpooled
		// endpoint is fine; no connection pool is held open.
		const url = env.DATABASE_URL ?? env.DATABASE_URL_UNPOOLED;
		if (!url) throw new Error('Neither DATABASE_URL nor DATABASE_URL_UNPOOLED is set');
		instance = drizzle(neon(url), { schema });
	}
	return instance;
}

export const db = new Proxy({} as Db, {
	get: (_target, prop) => Reflect.get(resolve(), prop)
});
