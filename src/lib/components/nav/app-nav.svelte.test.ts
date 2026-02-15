import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AppNav from './app-nav.svelte';

// Mock $app/stores
vi.mock('$app/stores', () => ({
	page: {
		subscribe: (callback: (value: { url: { pathname: string } }) => void) => {
			callback({ url: { pathname: '/' } });
			return () => {};
		}
	}
}));

describe('App Navigation', () => {
	it('should render all navigation links', () => {
		render(AppNav);

		expect(screen.getByRole('link', { name: /calendar/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /classes/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /modules/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /specifications/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy();
	});

	it('should have correct href attributes for all links', () => {
		render(AppNav);

		const calendarLinks = screen.getAllByRole('link', { name: /calendar/i });
		expect(calendarLinks[0].getAttribute('href')).toBe('/calendar');

		const classesLinks = screen.getAllByRole('link', { name: /classes/i });
		expect(classesLinks[0].getAttribute('href')).toBe('/classes');

		const modulesLinks = screen.getAllByRole('link', { name: /modules/i });
		expect(modulesLinks[0].getAttribute('href')).toBe('/modules');

		const specsLinks = screen.getAllByRole('link', { name: /specifications/i });
		expect(specsLinks[0].getAttribute('href')).toBe('/specifications');

		const settingsLinks = screen.getAllByRole('link', { name: /settings/i });
		expect(settingsLinks[0].getAttribute('href')).toBe('/settings');
	});

	it('should render the Planck logo link', () => {
		render(AppNav);

		const logos = screen.getAllByRole('link', { name: /planck/i });
		expect(logos.length).toBeGreaterThan(0);
		expect(logos[0].getAttribute('href')).toBe('/');
	});

	it('should render mobile menu button', () => {
		render(AppNav);

		const menuButtons = screen.getAllByRole('button', { name: /toggle mobile menu/i });
		expect(menuButtons.length).toBeGreaterThan(0);
	});
});
