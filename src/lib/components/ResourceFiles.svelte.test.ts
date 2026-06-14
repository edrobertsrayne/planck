import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

vi.mock('@vercel/blob/client', () => ({
	upload: vi.fn().mockResolvedValue({
		url: 'https://blob/new',
		pathname: 'lesson-files/u/new.pdf',
		contentType: 'application/pdf'
	})
}));

import ResourceFiles from './ResourceFiles.svelte';

const files = [
	{
		id: 1,
		filename: 'worksheet.pdf',
		blobUrl: 'https://blob/ws',
		contentType: 'application/pdf',
		size: 2048
	}
];

test('lists each file as a download link with a remove button', async () => {
	const screen = render(ResourceFiles, { files, ownerType: 'lesson', ownerId: 5 });
	await expect
		.element(screen.getByRole('link', { name: 'worksheet.pdf' }))
		.toHaveAttribute('href', 'https://blob/ws');
	await expect.element(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
});

test('shows a file input for uploading on a course owner', async () => {
	const screen = render(ResourceFiles, { files: [], ownerType: 'course', ownerId: 3 });
	const input = screen.container.querySelector('input[type="file"]');
	expect(input).not.toBeNull();
});

test('renders for a module owner', async () => {
	const screen = render(ResourceFiles, { files: [], ownerType: 'module', ownerId: 7 });
	const input = screen.container.querySelector('input[type="file"]');
	expect(input).not.toBeNull();
});
