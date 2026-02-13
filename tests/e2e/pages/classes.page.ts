import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class ClassesPage extends BasePage {
	readonly createButton: Locator;
	readonly createForm: Locator;
	readonly classCards: Locator;
	readonly yearGroupFilter: Locator;
	readonly successMessage: Locator;
	readonly errorMessage: Locator;

	constructor(page: Page) {
		super(page);
		this.createButton = page.locator(
			'button:has-text("Create New Class"), button:has-text("Cancel")'
		);
		this.createForm = page.locator('form[action="?/create"]');
		this.classCards = page.locator('a[href^="/classes/"]');
		this.yearGroupFilter = page.locator('#yearGroupFilter');
		this.successMessage = page.locator('.bg-green-50, [data-testid="success"]');
		this.errorMessage = page.locator('.bg-red-50, [data-testid="error"]');
	}

	async goto(): Promise<void> {
		await super.goto('/classes');
		await this.waitForLoading();
	}

	async createClass(data: {
		name: string;
		yearGroup: number;
		examSpecId: string;
		academicYear: string;
		studentCount?: string;
		room?: string;
		notes?: string;
	}): Promise<void> {
		await this.goto();
		await this.createButton.click();
		await expect(this.createForm).toBeVisible();

		await this.page.fill('#name', data.name);
		await this.page.selectOption('#yearGroup', String(data.yearGroup));
		await this.page.selectOption('#examSpecId', data.examSpecId);
		await this.page.fill('#academicYear', data.academicYear);

		if (data.studentCount) {
			await this.page.fill('#studentCount', data.studentCount);
		}
		if (data.room) {
			await this.page.fill('#room', data.room);
		}
		if (data.notes) {
			await this.page.fill('#notes', data.notes);
		}

		await this.page.click('button[type="submit"]:has-text("Create Class")');
		await this.waitForLoading();
	}

	async filterByYearGroup(yearGroup: number | null): Promise<void> {
		if (yearGroup === null) {
			await this.yearGroupFilter.selectOption({ index: 0 });
		} else {
			await this.yearGroupFilter.selectOption(String(yearGroup));
		}
		await this.waitForLoading();
	}

	async navigateToClass(classId: string): Promise<void> {
		await this.page.click(`a[href="/classes/${classId}"]`);
		await this.waitForLoading();
	}

	async getClassNames(): Promise<string[]> {
		const cards = this.classCards;
		const count = await cards.count();
		const names: string[] = [];
		for (let i = 0; i < count; i++) {
			const title = cards.nth(i).locator('h3');
			const text = await title.textContent();
			if (text) names.push(text);
		}
		return names;
	}

	async getClassCount(): Promise<number> {
		return this.classCards.count();
	}

	async hasCreateForm(): Promise<boolean> {
		return this.createForm.isVisible();
	}

	async cancelCreateForm(): Promise<void> {
		await this.page.click('button:has-text("Cancel")');
	}
}
