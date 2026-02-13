import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ModulesPage extends BasePage {
	readonly createButton: Locator;
	readonly createForm: Locator;
	readonly moduleCards: Locator;
	readonly specFilter: Locator;
	readonly successMessage: Locator;
	readonly errorMessage: Locator;

	constructor(page: Page) {
		super(page);
		this.createButton = page.locator(
			'button:has-text("Create New Module"), button:has-text("Cancel")'
		);
		this.createForm = page.locator('form[action="?/create"]');
		this.moduleCards = page.locator('a[href^="/modules/"]');
		this.specFilter = page.locator('#specFilter');
		this.successMessage = page.locator('.bg-green-50, [data-testid="success"]');
		this.errorMessage = page.locator('.bg-red-50, [data-testid="error"]');
	}

	async goto(): Promise<void> {
		await super.goto('/modules');
		await this.waitForLoading();
	}

	async createModule(data: {
		name: string;
		description?: string;
		targetSpecId?: string;
	}): Promise<void> {
		await this.goto();
		await this.createButton.click();
		await this.createForm.waitFor();

		await this.page.fill('#name', data.name);
		if (data.description) {
			await this.page.fill('#description', data.description);
		}
		if (data.targetSpecId) {
			await this.page.selectOption('#targetSpecId', data.targetSpecId);
		}

		await this.page.click('button[type="submit"]:has-text("Create Module")');
		await this.waitForLoading();
	}

	async filterBySpec(specId: string | null): Promise<void> {
		if (specId === null) {
			await this.specFilter.selectOption({ index: 0 });
		} else {
			await this.specFilter.selectOption(specId);
		}
		await this.waitForLoading();
	}

	async navigateToModule(moduleId: string): Promise<void> {
		await this.page.click(`a[href="/modules/${moduleId}"]`);
		await this.waitForLoading();
	}

	async getModuleNames(): Promise<string[]> {
		const cards = this.moduleCards;
		const count = await cards.count();
		const names: string[] = [];
		for (let i = 0; i < count; i++) {
			const title = cards.nth(i).locator('h3');
			const text = await title.textContent();
			if (text) names.push(text);
		}
		return names;
	}

	async getModuleCount(): Promise<number> {
		return this.moduleCards.count();
	}

	async hasCreateForm(): Promise<boolean> {
		return this.createForm.isVisible();
	}

	async cancelCreateForm(): Promise<void> {
		await this.page.click('button:has-text("Cancel")');
	}
}
