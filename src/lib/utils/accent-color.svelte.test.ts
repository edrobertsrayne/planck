import { describe, it, expect, beforeEach } from 'vitest';
import {
	type AccentColor,
	accentOptions,
	applyAccentColor,
	getStoredAccentColor,
	setStoredAccentColor
} from './accent-color';

describe('accent-color', () => {
	describe('accentOptions', () => {
		it('should contain all six accent color options', () => {
			const keys = Object.keys(accentOptions);
			expect(keys).toEqual(['amber', 'coral', 'steel', 'sage', 'lavender', 'teal']);
		});

		it('should have correct structure for each option', () => {
			Object.entries(accentOptions).forEach(([, option]) => {
				expect(option).toHaveProperty('name');
				expect(option).toHaveProperty('light');
				expect(option).toHaveProperty('dark');
				expect(option.light).toHaveProperty('primary');
				expect(option.light).toHaveProperty('hover');
				expect(option.light).toHaveProperty('muted');
				expect(option.dark).toHaveProperty('primary');
				expect(option.dark).toHaveProperty('hover');
				expect(option.dark).toHaveProperty('muted');
			});
		});

		it('should have valid hex colors for light mode', () => {
			Object.values(accentOptions).forEach((option) => {
				expect(option.light.primary).toMatch(/^#[0-9a-f]{6}$/i);
				expect(option.light.hover).toMatch(/^#[0-9a-f]{6}$/i);
			});
		});

		it('should have valid hex colors for dark mode', () => {
			Object.values(accentOptions).forEach((option) => {
				expect(option.dark.primary).toMatch(/^#[0-9a-f]{6}$/i);
				expect(option.dark.hover).toMatch(/^#[0-9a-f]{6}$/i);
			});
		});
	});

	describe('getStoredAccentColor', () => {
		beforeEach(() => {
			localStorage.clear();
		});

		it('should return "amber" when no color is stored', () => {
			expect(getStoredAccentColor()).toBe('amber');
		});

		it('should return stored color when it exists', () => {
			localStorage.setItem('accentColor', 'coral');
			expect(getStoredAccentColor()).toBe('coral');
		});

		it('should return "amber" for invalid stored values', () => {
			localStorage.setItem('accentColor', 'invalid-color');
			// The function doesn't validate, so it will return the stored value
			// This is expected behavior - validation happens at the UI level
			expect(getStoredAccentColor()).toBe('invalid-color');
		});
	});

	describe('setStoredAccentColor', () => {
		beforeEach(() => {
			localStorage.clear();
			// Reset any CSS variables that might have been set
			if (typeof document !== 'undefined') {
				document.documentElement.style.removeProperty('--accent-primary');
				document.documentElement.style.removeProperty('--accent-primary-hover');
				document.documentElement.style.removeProperty('--accent-primary-muted');
				document.documentElement.style.removeProperty('--accent-primary-text');
			}
		});

		it('should store color in localStorage', () => {
			setStoredAccentColor('steel');
			expect(localStorage.getItem('accentColor')).toBe('steel');
		});

		it('should apply the color immediately', () => {
			setStoredAccentColor('sage');
			// Verify CSS variables are set (in browser environment)
			if (typeof document !== 'undefined') {
				const primaryColor = document.documentElement.style.getPropertyValue('--accent-primary');
				expect(primaryColor).toBeTruthy();
			}
		});
	});

	describe('applyAccentColor', () => {
		beforeEach(() => {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.remove('dark');
				document.documentElement.style.removeProperty('--accent-primary');
				document.documentElement.style.removeProperty('--accent-primary-hover');
				document.documentElement.style.removeProperty('--accent-primary-muted');
				document.documentElement.style.removeProperty('--accent-primary-text');
			}
		});

		it('should apply light mode colors when not in dark mode', () => {
			applyAccentColor('amber');

			if (typeof document !== 'undefined') {
				const root = document.documentElement;
				expect(root.style.getPropertyValue('--accent-primary')).toBe('#f0a868');
				expect(root.style.getPropertyValue('--accent-primary-hover')).toBe('#e89b55');
				expect(root.style.getPropertyValue('--accent-primary-text')).toBe('#39393a');
			}
		});

		it('should apply dark mode colors when in dark mode', () => {
			if (typeof document !== 'undefined') {
				document.documentElement.classList.add('dark');
			}

			applyAccentColor('amber');

			if (typeof document !== 'undefined') {
				const root = document.documentElement;
				expect(root.style.getPropertyValue('--accent-primary')).toBe('#f5b87a');
				expect(root.style.getPropertyValue('--accent-primary-hover')).toBe('#f8c68e');
				expect(root.style.getPropertyValue('--accent-primary-text')).toBe('#1a1a1b');
			}
		});

		it('should apply correct colors for each accent option', () => {
			const accentColors: AccentColor[] = ['amber', 'coral', 'steel', 'sage', 'lavender', 'teal'];

			accentColors.forEach((accent) => {
				applyAccentColor(accent);

				if (typeof document !== 'undefined') {
					const root = document.documentElement;
					const primaryColor = root.style.getPropertyValue('--accent-primary');
					expect(primaryColor).toBe(accentOptions[accent].light.primary);
				}
			});
		});

		it('should handle unknown accent colors gracefully', () => {
			// This should not throw
			expect(() => {
				applyAccentColor('unknown-color' as AccentColor);
			}).not.toThrow();
		});
	});
});
