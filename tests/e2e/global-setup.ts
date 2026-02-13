import { chromium, type FullConfig } from '@playwright/test';
import { createTestDb, seedExamSpecs, seedTimetableConfig } from './helpers/db-helpers';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Global setup runs once before all tests
 * - Sets up test database
 * - Runs migrations
 * - Seeds reference data (exam specs)
 * - Creates test user and stores auth state
 */
async function globalSetup(config: FullConfig) {
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

	// Run database migrations
	console.log('🔄 Running database migrations...');
	try {
		// Use sh -c to pipe yes into drizzle-kit push
		execSync('sh -c \'echo "yes" | bun drizzle-kit push\'', {
			env: { ...process.env, DATABASE_URL: testDbPath },
			stdio: 'pipe'
		});
		console.log('✅ Database migrations complete');
	} catch (error) {
		console.error('Failed to run migrations:', error);
		throw error;
	}

	// Create database connection and seed data
	const { db, sqlite } = createTestDb();

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

	// Create authenticated user state
	console.log('🔐 Setting up test authentication...');
	const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ baseURL });
	const page = await context.newPage();

	try {
		// Navigate to register page
		await page.goto('/demo/better-auth/register');
		await page.waitForLoadState('networkidle');

		// Fill registration form
		await page.fill('input[name="name"]', 'Test User');
		await page.fill('input[name="email"]', 'test@example.com');
		await page.fill('input[name="password"]', 'password123');

		// Submit form
		await page.click('button[type="submit"]');

		// Wait for redirect after successful registration
		await page.waitForURL('/', { timeout: 5000 }).catch(() => {
			// If already registered, login instead
			console.log('User already exists, skipping registration');
		});

		// Save authenticated state
		const authFile = path.join(process.cwd(), 'tests/e2e/.auth/user.json');
		await context.storageState({ path: authFile });
		console.log(`✅ Auth state saved to ${authFile}`);
	} catch (error) {
		console.error('Failed to setup authentication:', error);
		// Don't throw - tests should handle authentication themselves if needed
	} finally {
		await context.close();
		await browser.close();
	}
}

export default globalSetup;
