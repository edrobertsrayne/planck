import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Default port for dev server
const PORT = process.env.PORT || 5173;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
	// Test directory
	testDir: './tests/e2e',

	// Global setup and teardown
	globalSetup: './tests/e2e/global-setup.ts',
	globalTeardown: './tests/e2e/global-teardown.ts',

	// Maximum time one test can run
	timeout: 30 * 1000, // 30 seconds

	// Test execution
	fullyParallel: false, // Run tests serially to avoid database conflicts
	forbidOnly: !!process.env.CI, // Fail in CI if test.only is left in
	retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
	workers: 1, // Single worker to avoid database race conditions

	// Reporter configuration
	reporter: [
		['html', { outputFolder: 'playwright-report' }],
		['list'],
		...(process.env.CI ? [['github'] as const] : [])
	],

	// Shared settings for all projects
	use: {
		// Base URL for navigation
		baseURL: BASE_URL,

		// Run in headless mode (required for headless server)
		headless: true,

		// Screenshot on failure
		screenshot: 'only-on-failure',

		// Collect trace on failure
		trace: 'retain-on-failure',

		// Video on failure
		video: 'retain-on-failure',

		// Navigation timeout
		navigationTimeout: 10 * 1000,

		// Action timeout
		actionTimeout: 5 * 1000
	},

	// Configure projects for major browsers
	// Note: Running on headless server, only Chromium in headless mode is supported
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				headless: true // Ensure headless mode for server environment
			}
		}

		// Firefox and WebKit not available on headless server
		// Mobile testing not available on headless server
	],

	// Run dev server before starting tests
	webServer: {
		command: 'bun run dev --host',
		port: Number(PORT),
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000, // 2 minutes to start server
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
