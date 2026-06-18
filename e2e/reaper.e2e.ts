/// <reference types="node" />
import { test, expect, type Page } from '@playwright/test';
import { put } from '@vercel/blob';
import {
	CRON_SECRET,
	BLOB_TOKEN,
	getClassByName,
	insertScheduledLesson,
	insertResourceFile,
	scheduledLessonExists
} from './helpers/db';

async function signUp(page: Page) {
	const email = `teacher_${Date.now()}@example.com`;
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').fill('password123');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);
}

test('cron endpoint rejects an unauthenticated request', async ({ request }) => {
	const res = await request.get('/api/cron/reap-scheduled-lessons');
	expect(res.status()).toBe(401);
});

test('reaper purges out-of-retention lesson and last-reference blob', async ({ page, request }) => {
	test.skip(!CRON_SECRET, 'CRON_SECRET missing from .env.test (run db:test:setup)');

	await signUp(page);

	// Create a subject (course) via the UI.
	const subject = `Physics ${Date.now()}`;
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();

	// Create a class for that subject.
	const className = `10Reap${Date.now()}`;
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill(className);
	await page.locator('select[name="courseId"]').selectOption({ label: subject });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByRole('link', { name: className, exact: true })).toBeVisible();

	// Derive the real auth userId from the class row the UI created.
	const { userId, classId } = await getClassByName(className);

	// Upload a real blob so we can verify it is reclaimed after reaped.
	if (!BLOB_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN not found — cannot create test blob');
	const blobKey = `e2e/aged-${Date.now()}.pdf`;
	const blob = await put(blobKey, Buffer.from('%PDF-1.4\n% aged\n'), {
		access: 'public',
		token: BLOB_TOKEN,
		addRandomSuffix: false
	});
	expect((await request.get(blob.url)).ok()).toBe(true);

	// Insert OLD lesson (2000-01-01 is well before any academic-year cutoff).
	const oldId = await insertScheduledLesson({
		userId,
		classId,
		title: 'Old lesson',
		date: '2000-01-01'
	});

	// Attach the blob as the sole reference.
	await insertResourceFile({
		userId,
		scheduledLessonId: oldId,
		blobUrl: blob.url,
		pathname: blob.pathname
	});

	// Insert KEEP lesson (today — within the current academic year).
	const keepId = await insertScheduledLesson({
		userId,
		classId,
		title: 'Keep lesson',
		date: new Date().toISOString().slice(0, 10)
	});

	// Call the reaper with the correct bearer token.
	const res = await request.get('/api/cron/reap-scheduled-lessons', {
		headers: { Authorization: `Bearer ${CRON_SECRET}` }
	});
	expect(res.ok()).toBe(true);
	const body = await res.json();
	expect(body.reaped).toBeGreaterThanOrEqual(1);

	// The old lesson must be gone; the keep lesson must survive.
	expect(await scheduledLessonExists(oldId)).toBe(false);
	expect(await scheduledLessonExists(keepId)).toBe(true);

	// The blob (last reference was on the old lesson) must be reclaimed.
	await expect
		.poll(async () => (await request.get(blob.url)).status(), { timeout: 15000 })
		.toBe(404);
});
