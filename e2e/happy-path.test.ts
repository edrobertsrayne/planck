import { test, expect } from '@playwright/test';

test('plan and schedule a module end to end', async ({ page }) => {
	const email = `teacher_${Date.now()}@example.com`;

	// Sign up
	await page.goto('/signup');
	await page.getByPlaceholder('Name').fill('Test Teacher');
	await page.getByPlaceholder('Email').fill(email);
	await page.getByPlaceholder('Password').fill('password123');
	await page.getByRole('button', { name: 'Sign up' }).click();
	await expect(page).toHaveURL(/\/agenda/);

	// Settings: a teaching block spanning the next ~4 weeks
	const today = new Date();
	const start = new Date(today);
	start.setDate(start.getDate() + 1);
	const end = new Date(today);
	end.setDate(end.getDate() + 28);
	const iso = (d: Date) => d.toISOString().slice(0, 10);

	await page.goto('/settings');
	await page.getByRole('button', { name: 'Save' }).click();
	await page.getByPlaceholder('Autumn 1').fill('Block 1');
	await page.locator('input[name="startDate"]').fill(iso(start));
	await page.locator('input[name="endDate"]').fill(iso(end));
	await page.getByRole('button', { name: 'Add block' }).click();

	// Course
	await page.goto('/courses');
	await page.getByPlaceholder('GCSE Chemistry').fill('GCSE Physics');
	await page.getByRole('button', { name: 'Add course' }).click();

	// Class tied to that course
	await page.goto('/classes');
	await page.getByPlaceholder('10Phy1').fill('10Phy1');
	await page.selectOption('select[name="courseId"]', { label: 'GCSE Physics' });
	await page.getByRole('button', { name: 'Add class' }).click();

	// Timetable: put 10Phy1 in Mon P1 (week A)
	await page.goto('/timetable');
	const monP1 = page.locator('tbody tr').first().locator('td').first();
	await monP1.locator('select[name="classId"]').selectOption({ label: '10Phy1' });

	// Module + lessons
	await page.goto('/courses');
	await page.getByRole('link', { name: 'GCSE Physics' }).click();
	await page.getByPlaceholder('Forces').fill('Forces');
	await page.getByRole('button', { name: 'Add module' }).click();
	await page.getByRole('link', { name: 'Forces' }).click();
	for (const t of ['L1 Intro', 'L2 Friction']) {
		await page.getByPlaceholder('L1: Intro to forces').fill(t);
		await page.getByRole('button', { name: 'Add lesson' }).click();
	}

	// Assign to the class
	await page.selectOption('select[name="classId"]', { label: '10Phy1' });
	await page.getByRole('button', { name: 'Assign' }).click();
	await expect(page.getByText(/Scheduled 2 lessons/)).toBeVisible();

	// Agenda shows the scheduled lessons
	await page.goto('/agenda');
	await expect(page.getByText('Forces — L1 Intro')).toBeVisible();
	await expect(page.getByText('10Phy1').first()).toBeVisible();
});
