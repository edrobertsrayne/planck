import { test, expect } from '@playwright/test';

test('shows an error and stays on /login when credentials are wrong', async ({ page }) => {
	await page.goto('/login');
	await page.getByPlaceholder('you@email.com').fill(`nobody_${Date.now()}@example.com`);
	await page.locator('input[type="password"]').fill('definitely-the-wrong-password');
	await page.getByRole('button', { name: 'Sign in' }).click();

	// Failure must surface a visible message to the user...
	await expect(page.getByRole('alert')).toBeVisible();
	// ...and must not navigate away from the login page.
	await expect(page).toHaveURL(/\/login/);
});
