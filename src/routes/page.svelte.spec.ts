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
				totalCourses: 0,
				nextHoliday: {
					id: 'test-holiday-1',
					type: 'holiday' as const,
					title: 'Half Term',
					startDate: new Date('2025-02-17'),
					endDate: new Date('2025-02-21'),
					affectsAllClasses: true,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			},
			todaysLessons: []
		};

		render(Page, { data: mockData });

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});
});
