import { type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class AuthPage extends BasePage {
	constructor(page: Page) {
		super(page);
	}

	async login(email: string, password: string): Promise<void> {
		await this.page.goto('/');
		await this.page.fill('input[name="email"], input[type="email"]', email);
		await this.page.fill('input[name="password"], input[type="password"]', password);
		await this.page.click(
			'button[type="submit"], button:has-text("Sign in"), button:has-text("Login")'
		);
		await this.page.waitForLoadState('networkidle');
	}

	async register(email: string, password: string, name?: string): Promise<void> {
		await this.page.goto('/');
		await this.page.fill('input[name="email"], input[type="email"]', email);
		await this.page.fill('input[name="password"], input[type="password"]', password);
		if (name) {
			await this.page.fill('input[name="name"]', name);
		}
		await this.page.click(
			'button[type="submit"], button:has-text("Sign up"), button:has-text("Register")'
		);
		await this.page.waitForLoadState('networkidle');
	}

	async logout(): Promise<void> {
		await this.page.click('button:has-text("Sign out"), button:has-text("Logout")');
		await this.page.waitForLoadState('networkidle');
	}

	async isLoggedIn(): Promise<boolean> {
		const userButton = this.page.locator('button:has-text("Sign out"), [data-testid="user-menu"]');
		return userButton.isVisible();
	}

	async getCurrentUser(): Promise<{ email: string; name: string } | null> {
		const userMenu = this.page.locator('[data-testid="user-menu"], nav button');
		if (!(await userMenu.isVisible())) {
			return null;
		}
		const email = await userMenu.textContent();
		return email ? { email, name: '' } : null;
	}
}
