import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AppearancePage from './+page.svelte';

describe('Appearance Settings Page', () => {
	beforeEach(() => {
		localStorage.clear();
		// Reset CSS variables
		if (typeof document !== 'undefined') {
			document.documentElement.style.removeProperty('--accent-primary');
			document.documentElement.style.removeProperty('--accent-primary-hover');
			document.documentElement.style.removeProperty('--accent-primary-muted');
			document.documentElement.style.removeProperty('--accent-primary-text');
			document.documentElement.classList.remove('dark');
		}
	});

	it('should render the page title', () => {
		render(AppearancePage);
		expect(screen.getByRole('heading', { name: /appearance/i })).toBeTruthy();
	});

	it('should render all six accent color options', () => {
		render(AppearancePage);

		expect(screen.getByLabelText(/amber/i)).toBeTruthy();
		expect(screen.getByLabelText(/coral/i)).toBeTruthy();
		expect(screen.getByLabelText(/steel/i)).toBeTruthy();
		expect(screen.getByLabelText(/sage/i)).toBeTruthy();
		expect(screen.getByLabelText(/lavender/i)).toBeTruthy();
		expect(screen.getByLabelText(/teal/i)).toBeTruthy();
	});

	it('should apply CSS variables when selecting a color', async () => {
		render(AppearancePage);

		const steelRadio = screen.getByLabelText(/steel/i);
		await fireEvent.click(steelRadio);

		if (typeof document !== 'undefined') {
			const root = document.documentElement;
			const primaryColor = root.style.getPropertyValue('--accent-primary');
			expect(primaryColor).toBeTruthy();
			expect(primaryColor).toBe('#6d9dc5'); // Steel light mode color
		}
	});

	it('should persist selection to localStorage', async () => {
		render(AppearancePage);

		const sageRadio = screen.getByLabelText(/sage/i);
		await fireEvent.click(sageRadio);

		expect(localStorage.getItem('accentColor')).toBe('sage');
	});

	it('should apply dark mode colors when dark class is present', async () => {
		if (typeof document !== 'undefined') {
			document.documentElement.classList.add('dark');
		}

		render(AppearancePage);

		const tealRadio = screen.getByLabelText(/teal/i);
		await fireEvent.click(tealRadio);

		if (typeof document !== 'undefined') {
			const root = document.documentElement;
			const primaryColor = root.style.getPropertyValue('--accent-primary');
			// After clicking teal, but starting with amber as default, it should apply teal
			expect(primaryColor).toBeTruthy();
		}
	});
});
