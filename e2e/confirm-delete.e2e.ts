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

/** Subject → module "Forces" → one lesson "L1 Intro". */
async function createSubjectWithLesson(page: Page, subject: string) {
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill(subject);
	await page.getByRole('button', { name: 'Add course' }).click();
	await page.getByRole('link', { name: subject }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByPlaceholder('Add a lesson to this module').fill('L1 Intro');
	await page.getByRole('button', { name: 'Add lesson' }).click();
	await expect(page.getByLabel('Lesson title')).toHaveValue('L1 Intro');
}

async function createClass(page: Page, subject: string, className: string) {
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill(className);
	await page.locator('select[name="courseId"]').selectOption({ label: subject });
	await page.getByRole('button', { name: 'Add class' }).click();
	await expect(page.getByRole('link', { name: className, exact: true })).toBeVisible();
}

/** Assign module "Forces" (under `subject`) to `className` — schedules its lesson. */
async function assignForcesTo(page: Page, subject: string, className: string) {
	await page.goto('/courses');
	await page.getByRole('link', { name: subject }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('button', { name: 'Assign to class' }).click();
	await page.getByRole('button', { name: className }).click();
	await page.getByRole('button', { name: /Assign to 1 class/ }).click();
}

test('subject delete: dialog shows non-zero counts, Cancel aborts, Delete cascades', async ({
	page
}) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Physics');
	await createClass(page, 'GCSE Physics', '10Phy1');
	await assignForcesTo(page, 'GCSE Physics', '10Phy1');

	// Open the confirm dialog from the courses list.
	await page.goto('/courses');
	await page.getByRole('button', { name: 'Delete subject' }).first().click();

	// Blast radius shows non-zero counts (1 class, 1 scheduled lesson).
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('its 1 class');
	await expect(dialog).toContainText('1 scheduled lesson');

	// Cancel aborts — the subject is still there.
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toBeVisible();

	// Reopen and confirm — the subject is gone.
	await page.getByRole('button', { name: 'Delete subject' }).first().click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toHaveCount(0);
});

test('class delete: dialog confirms then cascades', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Biology');
	await createClass(page, 'GCSE Biology', '10Bio1');
	await assignForcesTo(page, 'GCSE Biology', '10Bio1');

	await page.goto('/classes');
	await page.getByRole('button', { name: 'Delete class' }).first().click();
	await expect(page.getByRole('dialog')).toContainText('1 scheduled lesson');

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: '10Bio1', exact: true })).toHaveCount(0);
});

test('module delete: dialog shows lesson count then cascades', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE Chemistry');

	// On the course detail page, the module row has a Delete module trigger.
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Chemistry' }).click();
	await page.getByRole('button', { name: 'Delete module' }).first().click();
	await expect(page.getByRole('dialog')).toContainText('its 1 lesson');

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Forces' })).toHaveCount(0);
});

test('single scheduled-lesson delete stays one-click (no dialog)', async ({ page }) => {
	await signUp(page);
	await createSubjectWithLesson(page, 'GCSE History');
	await createClass(page, 'GCSE History', '10His1');
	await assignForcesTo(page, 'GCSE History', '10His1');

	await page.goto('/classes');
	await page.getByRole('link', { name: '10His1', exact: true }).click();
	await expect(page.locator('input[aria-label="Lesson title"]')).toHaveCount(1);

	// Clicking Delete removes the lesson immediately — no confirm dialog.
	await page.getByRole('button', { name: 'Delete' }).first().click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.locator('input[aria-label="Lesson title"]')).toHaveCount(0);
});
