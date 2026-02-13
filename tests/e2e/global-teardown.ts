import path from 'path';
import { execSync } from 'child_process';

/**
 * Global teardown runs once after all tests
 * - Cleans up test database
 * - Removes auth state files
 */
async function globalTeardown() {
	console.log('🧹 Cleaning up E2E test environment...');

	// Remove test database
	const testDbPath = path.join(process.cwd(), 'test-e2e.db');
	try {
		execSync(`rm -f ${testDbPath}`);
		console.log('✅ Test database removed');
	} catch (error) {
		console.error('Failed to remove test database:', error);
	}

	// Remove auth state files
	const authDir = path.join(process.cwd(), 'tests/e2e/.auth');
	try {
		execSync(`rm -rf ${authDir}`);
		console.log('✅ Auth state files removed');
	} catch (error) {
		console.error('Failed to remove auth state files:', error);
	}

	console.log('✅ Cleanup complete!');
}

export default globalTeardown;
