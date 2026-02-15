import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SettingsPage from './+page.svelte';

describe('Settings Landing Page', () => {
	it('should render the page heading', () => {
		render(SettingsPage);

		expect(screen.getByRole('heading', { name: /settings/i })).toBeTruthy();
	});

	it('should render link to Timetable Configuration', () => {
		render(SettingsPage);

		const links = screen.getAllByRole('link', { name: /timetable configuration/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0].getAttribute('href')).toBe('/settings/timetable');
	});

	it('should render link to Term Dates', () => {
		render(SettingsPage);

		const links = screen.getAllByRole('link', { name: /term dates/i });
		expect(links.length).toBeGreaterThan(0);
		expect(links[0].getAttribute('href')).toBe('/settings/term-dates');
	});

	it('should display descriptions for each settings section', () => {
		render(SettingsPage);

		expect(
			screen.getAllByText(/configure your timetable structure, periods, and week cycle/i).length
		).toBeGreaterThan(0);
		expect(
			screen.getAllByText(/import and manage academic year term dates and holidays/i).length
		).toBeGreaterThan(0);
	});

	it('should display help text about configuring the system', () => {
		render(SettingsPage);

		expect(
			screen.getAllByText(
				/configure your school's timetable structure and academic calendar to get started/i
			).length
		).toBeGreaterThan(0);
	});
});
