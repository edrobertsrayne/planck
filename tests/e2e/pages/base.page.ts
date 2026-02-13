import { type Page, expect } from '@playwright/test';

export class BasePage {
	readonly page: Page;
	readonly baseUrl: string;

	constructor(page: Page) {
		this.page = page;
		this.baseUrl = process.env.BASE_URL || 'http://localhost:5173';
	}

	async goto(path: string): Promise<void> {
		await this.page.goto(`${this.baseUrl}${path}`);
	}

	async waitForLoading(): Promise<void> {
		await this.page.waitForLoadState('networkidle');
	}

	async getErrorMessage(): Promise<string | null> {
		const errorLocator = this.page.locator('[role="alert"], .error, [data-testid="error"]');
		if (await errorLocator.isVisible()) {
			return errorLocator.textContent();
		}
		return null;
	}

	async getSuccessMessage(): Promise<string | null> {
		const successLocator = this.page.locator('[data-testid="success"], .success');
		if (await successLocator.isVisible()) {
			return successLocator.textContent();
		}
		return null;
	}

	async getPageTitle(): Promise<string> {
		return this.page.title();
	}

	async waitForUrl(pattern: string | RegExp): Promise<void> {
		await this.page.waitForURL(pattern);
	}

	async clickNavLink(href: string): Promise<void> {
		await this.page.click(`nav a[href="${href}"]`);
	}

	async expectUrl(pattern: string | RegExp): Promise<void> {
		await expect(this.page).toHaveURL(pattern);
	}
}
