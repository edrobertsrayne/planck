import { type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class NavPage extends BasePage {
	constructor(page: Page) {
		super(page);
	}

	async navigateTo(path: string): Promise<void> {
		await this.page.click(`nav a[href="${path}"]`);
		await this.waitForLoading();
	}

	async toggleMobileMenu(): Promise<void> {
		await this.page.click('button[aria-label="Toggle mobile menu"]');
	}

	async isMobileMenuOpen(): Promise<boolean> {
		const menu = this.page.locator('.sm:hidden');
		return menu.isVisible();
	}

	async getNavLinks(): Promise<string[]> {
		const links = this.page.locator('nav a');
		const count = await links.count();
		const texts: string[] = [];
		for (let i = 0; i < count; i++) {
			const text = await links.nth(i).textContent();
			if (text) texts.push(text.trim());
		}
		return texts;
	}

	async navigateToCalendar(): Promise<void> {
		await this.navigateTo('/calendar');
	}

	async navigateToClasses(): Promise<void> {
		await this.navigateTo('/classes');
	}

	async navigateToModules(): Promise<void> {
		await this.navigateTo('/modules');
	}

	async navigateToSpecifications(): Promise<void> {
		await this.navigateTo('/specifications');
	}

	async navigateToHome(): Promise<void> {
		await this.navigateTo('/');
	}
}
