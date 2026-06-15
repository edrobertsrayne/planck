import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import ResourceLinks from './ResourceLinks.svelte';

const links = [
	{ id: 1, url: 'https://youtube.com/watch?v=x', label: 'Intro video' },
	{ id: 2, url: 'https://example.com', label: null }
];

test('renders each link with its label or url as text, opening in a new tab', async () => {
	const screen = render(ResourceLinks, { links });
	const a = screen.getByRole('link', { name: 'Intro video' });
	await expect.element(a).toHaveAttribute('href', 'https://youtube.com/watch?v=x');
	await expect.element(a).toHaveAttribute('target', '_blank');
	// null-label link now shows the host as title (linkMeta fallback)
	await expect.element(screen.getByRole('link', { name: 'example.com' })).toBeInTheDocument();
});

test('renders an add-link form with url and label fields', async () => {
	const screen = render(ResourceLinks, { links: [] });
	await expect.element(screen.getByPlaceholder('https://…')).toBeInTheDocument();
	await expect.element(screen.getByRole('button', { name: 'Add link' })).toBeInTheDocument();
});
