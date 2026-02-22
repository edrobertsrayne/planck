import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const url = databaseUrl.startsWith('file:') ? databaseUrl : `file:${databaseUrl}`;
const client = createClient({ url });

await client.execute('PRAGMA foreign_keys = ON');

const db = drizzle({ client });
await migrate(db, { migrationsFolder: './drizzle' });

console.log('Migrations applied');
client.close();
