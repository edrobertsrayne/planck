import { test, expect } from '@playwright/test';

test('edit a lesson plan and attach a link from the lesson page', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up.
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Course → module → lesson.
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('Add a lesson to this module').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();

	// Open the lesson page via its open-lesson link. The lesson title is an
	// inline-editable input on the lesson page, so assert on its value.
	await page.getByRole('link', { name: 'Open lesson' }).first().click();
	await expect(page.getByLabel('Lesson title')).toHaveValue('L1 Intro');

	// Type into the Milkdown editor (mounts client-side). It autosaves (debounced);
	// wait for the savePlan POST to confirm the write landed.
	const editor = page.locator('.milkdown [contenteditable="true"]');
	await expect(editor).toBeVisible({ timeout: 10000 });
	await editor.click();
	await editor.pressSequentially('Lesson objectives: understand forces.');
	await page.waitForResponse(
		(resp) => resp.url().includes('savePlan') && resp.request().method() === 'POST',
		{ timeout: 10000 }
	);
	// The editor's status label reads "Saved" once persisted (exact match avoids
	// colliding with the static "Saved automatically" header text).
	await expect(page.getByText('Saved', { exact: true })).toBeVisible();

	// Add a link. Unlabelled links render with the host as their text, so assert
	// on the row's href rather than the visible label.
	await page.getByPlaceholder('https://…').fill('https://youtube.com/watch?v=abc');
	await page.getByRole('button', { name: 'Add link' }).click();
	await expect(page.locator('a[href="https://youtube.com/watch?v=abc"]')).toBeVisible();

	// Reload and assert persistence.
	await page.reload();
	await expect(page.locator('a[href="https://youtube.com/watch?v=abc"]')).toBeVisible();
	await expect(page.locator('.milkdown [contenteditable="true"]')).toBeVisible({ timeout: 10000 });
	await expect(page.locator('.milkdown')).toContainText('understand forces', { timeout: 10000 });
});
