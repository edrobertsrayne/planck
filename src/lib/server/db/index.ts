import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Build the connection lazily, on first use. SvelteKit's build-time `analyse`
// step imports every server module, and env vars aren't injected then — so
// constructing the client (or throwing on a missing URL) at import time breaks
// the build. By deferring to first access we only need DATABASE_URL at runtime.
let instance: Db | undefined;
function resolve(): Db {
	if (!instance) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
		instance = drizzle(neon(env.DATABASE_URL), { schema });
	}
	return instance;
}

export const db = new Proxy({} as Db, {
	get: (_target, prop) => Reflect.get(resolve(), prop)
});
