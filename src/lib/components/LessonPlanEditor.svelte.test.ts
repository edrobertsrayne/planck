import { render } from 'vitest-browser-svelte';
import { expect, test, vi } from 'vitest';

// Mock Crepe so the test does not mount a real ProseMirror instance.
vi.mock('@milkdown/crepe', () => {
	return {
		Crepe: class {
			create() {
				return Promise.resolve();
			}
			on() {
				return this;
			}
			getMarkdown() {
				return '# Edited';
			}
			destroy() {}
		}
	};
});

import LessonPlanEditor from './LessonPlanEditor.svelte';

test('renders the editor container', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	const container = screen.container.querySelector('.lesson-plan-editor');
	expect(container).not.toBeNull();
});

test('shows a save-status indicator and has no manual save button (autosave)', async () => {
	const screen = render(LessonPlanEditor, { value: '# Hello', saveAction: '?/savePlan' });
	await expect.element(screen.getByText('Saved')).toBeInTheDocument();
	expect(screen.container.querySelector('button')).toBeNull();
});
