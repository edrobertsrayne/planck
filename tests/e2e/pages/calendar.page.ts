import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class CalendarPage extends BasePage {
	readonly viewButtons: Locator;
	readonly dayViewButton: Locator;
	readonly weekViewButton: Locator;
	readonly termViewButton: Locator;
	readonly previousButton: Locator;
	readonly nextButton: Locator;
	readonly title: Locator;
	readonly periodSlots: Locator;
	readonly calendarGrid: Locator;

	constructor(page: Page) {
		super(page);
		this.viewButtons = page.locator(
			'button:has-text("Day"), button:has-text("Week"), button:has-text("Term")'
		);
		this.dayViewButton = page.locator('button:has-text("Day")');
		this.weekViewButton = page.locator('button:has-text("Week")');
		this.termViewButton = page.locator('button:has-text("Term")');
		this.previousButton = page.locator('button:has-text("← Previous")');
		this.nextButton = page.locator('button:has-text("Next →")');
		this.title = page.locator('h2');
		this.periodSlots = page.locator('.divide-y > div');
		this.calendarGrid = page.locator('table, .grid.grid-cols-7');
	}

	async goto(): Promise<void> {
		await super.goto('/calendar');
		await this.waitForLoading();
	}

	async switchView(view: 'day' | 'week' | 'term'): Promise<void> {
		const button =
			view === 'day'
				? this.dayViewButton
				: view === 'week'
					? this.weekViewButton
					: this.termViewButton;
		await button.click();
		await this.waitForLoading();
	}

	async navigatePrevious(): Promise<void> {
		await this.previousButton.click();
		await this.waitForLoading();
	}

	async navigateNext(): Promise<void> {
		await this.nextButton.click();
		await this.waitForLoading();
	}

	async getCurrentView(): Promise<string> {
		if (await this.dayViewButton.evaluate((el) => el.getAttribute('variant') === 'default')) {
			return 'day';
		}
		if (await this.weekViewButton.evaluate((el) => el.getAttribute('variant') === 'default')) {
			return 'week';
		}
		return 'term';
	}

	async getPeriodCount(): Promise<number> {
		return this.periodSlots.count();
	}

	async hasLessonInPeriod(period: number): Promise<boolean> {
		const slot = this.periodSlots.nth(period - 1);
		const lessonLink = slot.locator('a, button');
		return lessonLink.isVisible();
	}

	async isConfigured(): Promise<boolean> {
		const noConfig = this.page.locator('text=No timetable configuration found');
		const noClasses = this.page.locator('text=No classes found');
		return !(await noConfig.isVisible()) && !(await noClasses.isVisible());
	}
}
