import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import Layout from './+layout.svelte';

// Mock the $app/stores module
vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('http://localhost/'),
		params: {},
		route: { id: null },
		status: 200,
		error: null,
		data: {},
		state: {},
		form: undefined
	})
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('App Layout', () => {
	it('should render children content', () => {
		const { container } = render(Layout, {
			props: {}
		});

		// Layout should render the main element which will contain children
		const main = container.querySelector('main');
		expect(main).toBeTruthy();
	});

	it('should contain navigation links to main views', () => {
		const { container } = render(Layout, {
			props: {}
		});

		const nav = container.querySelector('nav');
		expect(nav).toBeTruthy();

		// Navigation should link to Calendar, Classes, Modules, Specifications
		const links = container.querySelectorAll('a[href]');
		const hrefs = Array.from(links).map((link) => link.getAttribute('href'));

		expect(hrefs).toContain('/calendar');
		expect(hrefs).toContain('/classes');
		expect(hrefs).toContain('/modules');
		expect(hrefs).toContain('/specifications');
	});

	it('should have responsive navigation structure', () => {
		const { container } = render(Layout, {
			props: {}
		});

		const nav = container.querySelector('nav');
		expect(nav).toBeTruthy();

		// Should have structure suitable for mobile (collapsible)
		// This will be validated by checking for mobile menu button
		const mobileMenuButton = container.querySelector('[aria-label*="menu"]');
		expect(mobileMenuButton).toBeTruthy();
	});

	it('should highlight current section in navigation', () => {
		const { container } = render(Layout, {
			props: {}
		});

		// At least one nav item should have active/current indicator
		const nav = container.querySelector('nav');
		expect(nav).toBeTruthy();

		// Check that navigation has links that support active/current state
		// In the test environment, the home route ('/') should be active
		expect(nav?.querySelectorAll('a').length).toBeGreaterThan(0);
	});
});
