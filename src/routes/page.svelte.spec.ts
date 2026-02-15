import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		const mockData = {
			academicYear: '2024-25',
			stats: {
				totalClasses: 0,
				upcomingLessonsThisWeek: 0,
				totalModules: 0,
				nextHoliday: null
			},
			todaysLessons: []
		};

		render(Page, { data: mockData });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});
});
