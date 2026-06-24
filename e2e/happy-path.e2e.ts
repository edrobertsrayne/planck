import { test, expect } from '@playwright/test';

test('plan and schedule a module end to end', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up.
	await page.goto('/signup');
	await page.getByPlaceholder('Sofia Marsh').fill('Test Teacher');
	await page.getByPlaceholder('you@email.com').fill(email);
	await page.locator('input[type="password"]').first().fill('password1234');
	await page.locator('input[type="password"]').nth(1).fill('password1234');
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Settings: persist the default config, then add a term spanning the next ~4 weeks.
	const today = new Date();
	const start = new Date(today);
	start.setDate(start.getDate() + 1);
	const end = new Date(today);
	end.setDate(end.getDate() + 28);
	const iso = (d: Date) => d.toISOString().slice(0, 10);

	await page.goto('/settings');
	await page.getByRole('button', { name: 'Save' }).click();

	const termForm = page.locator('form[action="?/addBlock"]');
	await termForm.getByPlaceholder('Term name').fill('Block 1');
	await termForm.locator('input[name="startDate"]').fill(iso(start));
	await termForm.locator('input[name="endDate"]').fill(iso(end));
	await termForm.locator('button[type="submit"]').click();
	// The forms use `use:enhance`: the POST is async and the list re-renders in
	// place. Wait for the created row to appear before navigating away, otherwise
	// we can race past the commit and land on the next page with stale data.
	await expect(page.getByText('Block 1')).toBeVisible();

	// Course.
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByRole('link', { name: 'GCSE Physics' })).toBeVisible();

	// Class tied to that course.
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill('10Phy1');
	await page.selectOption('select[name="courseId"]', { label: 'GCSE Physics' });
	await page.getByRole('button', { name: 'Add class' }).click();
	// Scope to <main>: the class also appears in the sidebar's "My classes" nav.
	await expect(page.getByRole('main').getByRole('link', { name: '10Phy1' })).toBeVisible();

	// Timetable: put 10Phy1 in the first cell (Mon P1, week A) via its popup menu.
	await page.goto('/timetable');
	const grid = page.locator('div.min-w-\\[720px\\]').first();
	const firstPeriodRow = grid.locator('> div.mb-2\\.5').first();
	const monP1 = firstPeriodRow.locator('> div.relative').first();
	await monP1.locator('button').first().click();
	await page.getByRole('button', { name: '10Phy1' }).click();

	// Module + lessons.
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Add module').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	for (const t of ['L1 Intro', 'L2 Friction']) {
		await page.getByPlaceholder('Add a lesson to this module').fill(t);
		await page.getByRole('button', { name: 'Add lesson' }).click();
	}

	// Assign to the class via the multi-select modal.
	await page.getByRole('button', { name: 'Assign to class' }).click();
	await page.getByRole('button', { name: '10Phy1' }).click();
	await page.getByRole('button', { name: /Assign to \d+ class/ }).click();
	// The modal closes only after the assign POST(s) have resolved.
	await expect(page.getByRole('heading', { name: 'Assign to classes' })).toBeHidden();

	// Agenda shows the scheduled lessons.
	await page.goto('/agenda');
	await expect(page.getByText('L1 Intro').first()).toBeVisible();
	await expect(page.getByText('10Phy1').first()).toBeVisible();
});
