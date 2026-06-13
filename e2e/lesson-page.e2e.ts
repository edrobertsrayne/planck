import { test, expect } from '@playwright/test';

test('edit a lesson plan and attach a link from the lesson page', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up.
	await page.goto('/signup');
	await page.getByPlaceholder('Name').fill('Test Teacher');
	await page.getByPlaceholder('Email').fill(email);
	await page.getByPlaceholder('Password').fill('password123');
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Course → module → lesson.
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Forces').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('L1: Intro to forces').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();

	// Open the lesson page via its title link (added in Task 15).
	await page.getByRole('link', { name: /L1 Intro/ }).click();
	await expect(page.getByRole('heading', { name: 'L1 Intro' })).toBeVisible();

	// Type into the Milkdown editor (mounts client-side) and save.
	const editor = page.locator('.milkdown [contenteditable="true"]');
	await expect(editor).toBeVisible({ timeout: 10000 });
	await editor.click();
	await editor.pressSequentially('Lesson objectives: understand forces.');
	await page.getByRole('button', { name: 'Save plan' }).click();

	// Add a link.
	await page.getByPlaceholder('https://…').fill('https://youtube.com/watch?v=abc');
	await page.getByRole('button', { name: 'Add link' }).click();
	await expect(page.getByRole('link', { name: 'https://youtube.com/watch?v=abc' })).toBeVisible();

	// Reload and assert persistence.
	await page.reload();
	await expect(page.getByRole('link', { name: 'https://youtube.com/watch?v=abc' })).toBeVisible();
	await expect(page.locator('.milkdown [contenteditable="true"]')).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.milkdown')).toContainText('understand forces', { timeout: 10000 });
});
