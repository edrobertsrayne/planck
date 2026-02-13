import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
	test('should load homepage', async ({ page }) => {
		await page.goto('/');

		// Verify navigation is visible with Planck branding
		await expect(page.locator('nav a:has-text("Planck")')).toBeVisible();

		// Verify homepage content
		await expect(page.locator('h1')).toContainText(/welcome/i);
	});

	test('should navigate to calendar', async ({ page }) => {
		await page.goto('/');

		// Click on calendar link in navigation
		await page.click('a[href="/calendar"]');

		// Verify we're on the calendar page
		await expect(page).toHaveURL('/calendar');
	});

	test('should navigate to classes', async ({ page }) => {
		await page.goto('/');

		// Click on classes link in navigation
		await page.click('a[href="/classes"]');

		// Verify we're on the classes page
		await expect(page).toHaveURL('/classes');
	});

	test('should navigate to modules', async ({ page }) => {
		await page.goto('/');

		// Click on modules link in navigation
		await page.click('a[href="/modules"]');

		// Verify we're on the modules page
		await expect(page).toHaveURL('/modules');
	});

	test('should navigate to specifications', async ({ page }) => {
		await page.goto('/');

		// Click on specifications link in navigation
		await page.click('a[href="/specifications"]');

		// Verify we're on the specifications page
		await expect(page).toHaveURL('/specifications');
	});
});
