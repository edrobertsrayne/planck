import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import { expect, test } from 'vitest';
import Button from './Button.svelte';

// Build a real Svelte snippet for the button label, the way a parent component would.
function label(text: string) {
	return createRawSnippet(() => ({
		render: () => `<span>${text}</span>`
	}));
}

test('renders primary variant by default with pink background', async () => {
	const screen = render(Button, { children: label('Save') });
	const btn = screen.getByRole('button', { name: 'Save' });
	await expect.element(btn).toBeInTheDocument();
	await expect.element(btn).toHaveClass(/bg-pink/);
});

test('passes through the submit type so it can submit forms', async () => {
	const screen = render(Button, { type: 'submit', children: label('Add') });
	const btn = screen.getByRole('button', { name: 'Add' });
	await expect.element(btn).toHaveAttribute('type', 'submit');
});
