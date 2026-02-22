import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('App Navigation', () => {
	it('should render all navigation links', () => {
		render(AppNav);

		expect(screen.getByRole('link', { name: /calendar/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /classes/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /courses/i })).toBeTruthy();
		expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy();
	});

	it('should have correct href attributes for all links', () => {
		render(AppNav);

		const calendarLinks = screen.getAllByRole('link', { name: /calendar/i });
		expect(calendarLinks[0].getAttribute('href')).toBe('/calendar');

		const classesLinks = screen.getAllByRole('link', { name: /classes/i });
		expect(classesLinks[0].getAttribute('href')).toBe('/classes');

		const coursesLinks = screen.getAllByRole('link', { name: /courses/i });
		expect(coursesLinks[0].getAttribute('href')).toBe('/courses');

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

describe('Dark Mode Toggle', () => {
	let localStorageMock: Record<string, string>;

	beforeEach(() => {
		// Mock localStorage
		localStorageMock = {};
		const mockStorage = {
			getItem: vi.fn((key: string) => localStorageMock[key] || null),
			setItem: vi.fn((key: string, value: string) => {
				localStorageMock[key] = value;
			}),
			removeItem: vi.fn((key: string) => {
				delete localStorageMock[key];
			}),
			clear: vi.fn(() => {
				localStorageMock = {};
			}),
			key: vi.fn(),
			length: 0
		} as Storage;

		Object.defineProperty(window, 'localStorage', {
			writable: true,
			value: mockStorage
		});

		// Mock matchMedia
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn()
			}))
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should render dark mode toggle button', () => {
		render(AppNav);

		const toggleButtons = screen.getAllByLabelText(/switch to dark mode/i);
		expect(toggleButtons.length).toBeGreaterThan(0);
	});

	it('should initialize with light mode by default', () => {
		render(AppNav);

		const toggleButtons = screen.getAllByLabelText(/switch to dark mode/i);
		expect(toggleButtons.length).toBeGreaterThan(0);
	});

	it('should toggle theme when button is clicked', async () => {
		render(AppNav);

		const toggleButtons = screen.getAllByLabelText(/switch to dark mode/i);
		await fireEvent.click(toggleButtons[0]);

		expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);

		// Click again to toggle back
		const lightModeButtons = screen.getAllByLabelText(/switch to light mode/i);
		await fireEvent.click(lightModeButtons[0]);

		expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('should respect system preference for dark mode', () => {
		// Mock system dark mode preference
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: query === '(prefers-color-scheme: dark)',
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn()
			}))
		});

		render(AppNav);

		// Should initialize in dark mode based on system preference
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('should load saved theme from localStorage', () => {
		localStorageMock['theme'] = 'dark';

		render(AppNav);

		expect(localStorage.getItem).toHaveBeenCalledWith('theme');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('should show correct icon based on theme', async () => {
		render(AppNav);

		// Should show Moon icon in light mode
		const moonIcons = screen.getAllByLabelText(/switch to dark mode/i);
		expect(moonIcons.length).toBeGreaterThan(0);

		// Toggle to dark mode
		await fireEvent.click(moonIcons[0]);

		// Should show Sun icon in dark mode
		const sunIcons = screen.getAllByLabelText(/switch to light mode/i);
		expect(sunIcons.length).toBeGreaterThan(0);
	});
});
