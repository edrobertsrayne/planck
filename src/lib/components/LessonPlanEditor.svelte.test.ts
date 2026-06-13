import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

// Mock Crepe so the test does not mount a real ProseMirror instance.
vi.mock('@milkdown/crepe', () => {
	return {
		Crepe: class {
			create() {
				return Promise.resolve();
			}
			getMarkdown() {
				return '# Edited';
			}
			destroy() {}
		}
	};
});

import LessonPlanEditor from './LessonPlanEditor.svelte';

test('renders an editor container and a Save button', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	await expect.element(screen.getByRole('button', { name: 'Save plan' })).toBeInTheDocument();
});

test('submits the current markdown in a hidden field on save', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	const hidden = screen.container.querySelector('input[name="plan"]') as HTMLInputElement;
	await expect.element(screen.getByRole('button', { name: 'Save plan' })).toBeInTheDocument();
	expect(hidden).not.toBeNull();
});
