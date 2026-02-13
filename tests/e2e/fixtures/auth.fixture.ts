import { test as base } from '@playwright/test';
import path from 'path';

/**
 * Authentication fixture that provides an authenticated context
 * Uses the saved auth state from global setup
 */
export const test = base.extend({
	// Use saved authenticated state
	storageState: path.join(__dirname, '../.auth/user.json')
});

export { expect } from '@playwright/test';
