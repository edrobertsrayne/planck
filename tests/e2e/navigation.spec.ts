import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
	test('should load homepage', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/Planck/i);
	});

	test('should navigate to specifications', async ({ page }) => {
		await page.goto('/');

		// Click on specifications link in navigation
		await page.click('a[href="/specifications"]');

		// Verify we're on the specifications page
		await expect(page).toHaveURL('/specifications');
		await expect(page.locator('h1')).toContainText(/specifications/i);
	});

	test('should navigate to classes', async ({ page }) => {
		await page.goto('/');

		// Click on classes link in navigation
		await page.click('a[href="/classes"]');

		// Verify we're on the classes page
		await expect(page).toHaveURL('/classes');
		await expect(page.locator('h1')).toContainText(/classes/i);
	});

	test('should navigate to modules', async ({ page }) => {
		await page.goto('/');

		// Click on modules link in navigation
		await page.click('a[href="/modules"]');

		// Verify we're on the modules page
		await expect(page).toHaveURL('/modules');
		await expect(page.locator('h1')).toContainText(/modules/i);
	});

	test('should navigate to calendar', async ({ page }) => {
		await page.goto('/');

		// Click on calendar link in navigation
		await page.click('a[href="/calendar"]');

		// Verify we're on the calendar page
		await expect(page).toHaveURL('/calendar');
	});

	test('should navigate to settings', async ({ page }) => {
		await page.goto('/');

		// Click on settings link in navigation
		await page.click('a[href="/settings"]');

		// Verify we're on the settings page
		await expect(page).toHaveURL('/settings');
		await expect(page.locator('h1')).toContainText(/settings/i);
	});
});
