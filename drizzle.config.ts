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
