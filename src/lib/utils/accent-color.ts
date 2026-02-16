import { browser } from '$app/environment';

export type AccentColor = 'amber' | 'coral' | 'steel' | 'sage' | 'lavender' | 'teal';

export interface AccentColorValues {
	primary: string;
	hover: string;
	muted: string;
}

export const accentOptions: Record<
	AccentColor,
	{ name: string; light: AccentColorValues; dark: AccentColorValues }
> = {
	amber: {
		name: 'Amber',
		light: { primary: '#f0a868', hover: '#e89b55', muted: 'rgba(240, 168, 104, 0.15)' },
		dark: { primary: '#f5b87a', hover: '#f8c68e', muted: 'rgba(240, 168, 104, 0.2)' }
	},
	coral: {
		name: 'Coral',
		light: { primary: '#e54f6d', hover: '#d63d5b', muted: 'rgba(229, 79, 109, 0.15)' },
		dark: { primary: '#f06580', hover: '#f57b93', muted: 'rgba(229, 79, 109, 0.2)' }
	},
	steel: {
		name: 'Steel',
		light: { primary: '#6d9dc5', hover: '#5a8db8', muted: 'rgba(109, 157, 197, 0.15)' },
		dark: { primary: '#7dadd5', hover: '#8dbde5', muted: 'rgba(109, 157, 197, 0.2)' }
	},
	sage: {
		name: 'Sage',
		light: { primary: '#88bb92', hover: '#76ab80', muted: 'rgba(136, 187, 146, 0.15)' },
		dark: { primary: '#98cba2', hover: '#a8d5b2', muted: 'rgba(136, 187, 146, 0.2)' }
	},
	lavender: {
		name: 'Lavender',
		light: { primary: '#b07aad', hover: '#a0699d', muted: 'rgba(176, 122, 173, 0.15)' },
		dark: { primary: '#c08abd', hover: '#d09acd', muted: 'rgba(176, 122, 173, 0.2)' }
	},
	teal: {
		name: 'Teal',
		light: { primary: '#7aada0', hover: '#689d90', muted: 'rgba(122, 173, 160, 0.15)' },
		dark: { primary: '#8abdb0', hover: '#9acdc0', muted: 'rgba(122, 173, 160, 0.2)' }
	}
};

export function applyAccentColor(accent: AccentColor): void {
	if (!browser) return;

	const option = accentOptions[accent];
	if (!option) return;

	const root = document.documentElement;
	const isDark = root.classList.contains('dark');
	const colors = isDark ? option.dark : option.light;

	// Determine text color based on brightness of primary color
	// For dark mode, use dark text; for light mode, use dark text on light colors
	const textColor = isDark ? '#1a1a1b' : '#39393a';

	root.style.setProperty('--accent-primary', colors.primary);
	root.style.setProperty('--accent-primary-hover', colors.hover);
	root.style.setProperty('--accent-primary-muted', colors.muted);
	root.style.setProperty('--accent-primary-text', textColor);
}

export function getStoredAccentColor(): AccentColor {
	if (!browser) return 'amber';
	const stored = localStorage.getItem('accentColor');
	return (stored as AccentColor) || 'amber';
}

export function setStoredAccentColor(accent: AccentColor): void {
	if (!browser) return;
	localStorage.setItem('accentColor', accent);
	applyAccentColor(accent);
}
