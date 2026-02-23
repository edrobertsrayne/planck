import { Client } from 'pg';
import { readFileSync } from 'fs';

const client = new Client({
	connectionString: process.env.DATABASE_URL
});

async function migrate() {
	try {
		await client.connect();
		console.log('✓ Connected to database');

		// Read and execute the migration SQL
		const migrationSQL = readFileSync('./drizzle/0000_init_postgres.sql', 'utf-8');
		await client.query(migrationSQL);
		console.log('✓ Migration applied successfully');

		await client.end();
	} catch (error) {
		console.error('✗ Migration failed:', error);
		process.exit(1);
	}
}

migrate();
