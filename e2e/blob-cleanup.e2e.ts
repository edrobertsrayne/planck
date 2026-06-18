/// <reference types="node" />
import { test, expect, type Page } from '@playwright/test';

async function signUp(page: Page) {
	const email = `teacher_${Date.now()}@example.com`;
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);
}

/** Create subject → module → lesson, open the lesson. */
async function createLessonAndOpen(page: Page, subject: string) {
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: subject }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('Add a lesson to this module').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();
	await page.locator('a[title="Open lesson"]').first().click();
	await expect(page.getByLabel('Lesson title')).toHaveValue('L1 Intro');
}

/** Upload a PDF on the current owner page and return its blob URL. */
async function uploadFile(page: Page, filename: string): Promise<string> {
	await page.locator('input[type="file"]').setInputFiles({
		name: filename,
		mimeType: 'application/pdf',
		buffer: Buffer.from('%PDF-1.4\n% test file\n')
	});
	const link = page.getByRole('link', { name: filename });
	await expect(link).toBeVisible({ timeout: 20000 });
	const url = await link.getAttribute('href');
	expect(url).toMatch(/^https?:\/\//);
	return url as string;
}

test('deleting a subject reclaims its lesson file blobs', async ({ page, request }) => {
	await signUp(page);
	await createLessonAndOpen(page, 'GCSE Physics');
	const blobUrl = await uploadFile(page, 'notes.pdf');

	// Blob exists now.
	expect((await request.get(blobUrl)).ok()).toBe(true);

	// Delete the subject from the courses list.
	await page.goto('/courses');
	await page.getByRole('button', { name: 'Delete subject' }).first().click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);

	// Blob is reclaimed (Vercel Blob serves 404 for a deleted pathname).
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(404);
});

test('shared blob survives template-lesson delete, reclaimed when last reference goes', async ({
	page,
	request
}) => {
	await signUp(page);
	await createLessonAndOpen(page, 'GCSE Biology');
	const blobUrl = await uploadFile(page, 'cells.pdf');

	// Create a class for the subject.
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill('10Bio1');
	await page.locator('select[name="courseId"]').selectOption({ label: 'GCSE Biology' });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByText('10Bio1')).toBeVisible();

	// Assign the module to the class — copies the lesson, sharing the blob.
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Biology' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('button', { name: 'Assign to class' }).click();
	await page.getByRole('button', { name: '10Bio1' }).click();
	await page.getByRole('button', { name: /Assign to 1 class/ }).click();

	// Delete the template lesson. Its scheduled copy still references the blob.
	await page.reload();
	await page.getByRole('button', { name: 'Delete lesson' }).first().click();

	// Shared blob still alive (scheduled copy references it).
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(200);

	// The scheduled lesson survived the template delete (detached).
	await page.goto('/classes');
	await page.getByRole('link', { name: '10Bio1' }).click();
	await expect(page.locator('input[aria-label="Lesson title"]').first()).toHaveValue('L1 Intro');

	// Delete the class — removes the last reference; blob is reclaimed.
	await page.goto('/classes');
	await page.getByRole('button', { name: 'Delete class' }).first().click();
	await expect
		.poll(async () => (await request.get(blobUrl)).status(), { timeout: 15000 })
		.toBe(404);
});
