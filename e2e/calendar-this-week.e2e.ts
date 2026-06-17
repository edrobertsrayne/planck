import { test, expect } from '@playwright/test';

test('the "This week" button returns the calendar to the current week', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up to get an authenticated session.
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// On the current week the button is hidden — there is nowhere to jump to.
	await page.goto('/calendar');
	const thisWeek = page.getByRole('link', { name: 'This week' });
	await expect(thisWeek).toBeHidden();

	// Navigating away from the current week reveals it.
	await page.getByRole('link', { name: /Next/ }).click();
	await expect(thisWeek).toBeVisible();

	// Clicking it returns to the current week, where it hides again.
	await thisWeek.click();
	await expect(thisWeek).toBeHidden();
});
