import type { FullConfig } from '@playwright/test';
import { createTestDb, seedExamSpecs, seedTimetableConfig } from './helpers/db-helpers';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Global setup runs once before all tests
 * - Sets up test database
 * - Runs migrations
 * - Seeds reference data (exam specs, timetable config)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
	console.log('🧪 Setting up E2E test environment...');

	// Set test database URL
	const testDbPath = path.join(process.cwd(), 'test-e2e.db');
	process.env.TEST_DATABASE_URL = testDbPath;
	process.env.DATABASE_URL = testDbPath;

	console.log(`📦 Using test database: ${testDbPath}`);

	// Remove existing test database
	try {
		execSync(`rm -f ${testDbPath}`);
	} catch {
		// Ignore if file doesn't exist
	}

	// Create database connection
	const { db, sqlite } = createTestDb();

	// Run database migrations
	console.log('🔄 Running database migrations...');
	try {
		migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
		console.log('✅ Database migrations complete');
	} catch (error) {
		console.error('Failed to run migrations:', error);
		sqlite.close();
		throw error;
	}

	try {
		console.log('🌱 Seeding test data...');

		// Seed exam specifications
		await seedExamSpecs(db);

		// Seed timetable configuration
		await seedTimetableConfig(db);

		console.log('✅ Test environment setup complete!');
	} catch (error) {
		console.error('Failed to seed test data:', error);
		throw error;
	} finally {
		sqlite.close();
	}
}

export default globalSetup;
