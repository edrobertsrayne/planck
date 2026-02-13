import { test, expect } from '@playwright/test';
import { ClassesPage } from './pages/classes.page';

test.describe('Classes', () => {
	test.describe('List View', () => {
		test('should display empty state when no classes exist', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await expect(page.locator('h1')).toContainText('Classes');
			await expect(page.locator('text=No classes yet')).toBeVisible();
		});

		test('should show create button', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await expect(page.locator('button:has-text("Create New Class")')).toBeVisible();
		});
	});

	test.describe('Create Class', () => {
		test('should create a new class', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await classesPage.createClass({
				name: '11X/Ph1',
				yearGroup: 11,
				examSpecId: 'test-gcse-aqa',
				academicYear: '2024-25',
				studentCount: '25',
				room: 'Lab 3'
			});

			await expect(page.locator('.bg-green-50')).toContainText('Class created successfully');

			const classNames = await classesPage.getClassNames();
			expect(classNames).toContain('11X/Ph1');
		});

		test('should validate required fields', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await page.click('button:has-text("Create New Class")');
			await page.click('button[type="submit"]:has-text("Create Class")');

			await expect(page.locator('text=required')).toBeVisible();
		});

		test('should cancel create form', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await page.click('button:has-text("Create New Class")');
			await expect(page.locator('text=Create New Class')).toBeVisible();

			await classesPage.cancelCreateForm();
			await expect(page.locator('button:has-text("Create New Class")')).toBeVisible();
		});
	});

	test.describe('Filter', () => {
		test.beforeEach(async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await classesPage.createClass({
				name: 'Year 11 Test Class',
				yearGroup: 11,
				examSpecId: 'test-gcse-aqa',
				academicYear: '2024-25'
			});

			await classesPage.createClass({
				name: 'Year 10 Test Class',
				yearGroup: 10,
				examSpecId: 'test-gcse-aqa',
				academicYear: '2024-25'
			});
		});

		test('should filter by year group', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await classesPage.filterByYearGroup(11);

			const classNames = await classesPage.getClassNames();
			expect(classNames).toContain('Year 11 Test Class');
		});

		test('should show all when filter is cleared', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			await classesPage.filterByYearGroup(11);
			await classesPage.filterByYearGroup(null);

			const count = await classesPage.getClassCount();
			expect(count).toBeGreaterThan(1);
		});
	});

	test.describe('Navigation', () => {
		test('should navigate to class details', async ({ page }) => {
			const classesPage = new ClassesPage(page);
			await classesPage.goto();

			const classCount = await classesPage.getClassCount();
			if (classCount > 0) {
				await page.click('a[href^="/classes/"] >> nth=0');
				await expect(page).toHaveURL(/\/classes\/.+/);
			}
		});
	});
});
