import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ModulePage from './+page.svelte';
import type { PageData } from './$types';

// Mock $app/forms
vi.mock('$app/forms', () => ({
	enhance: () => () => {}
}));

// Mock $app/paths
vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

describe('Module Editor Drag and Drop', () => {
	let mockData: PageData;

	beforeEach(() => {
		mockData = {
			module: {
				id: 'module-1',
				name: 'Test Module',
				description: 'Test description',
				targetSpecId: 'spec-1',
				createdAt: new Date(),
				updatedAt: new Date(),
				targetSpec: {
					id: 'spec-1',
					board: 'AQA',
					level: 'GCSE',
					name: 'AQA GCSE Physics',
					specCode: '8463',
					specYear: '2018'
				}
			},
			lessons: [
				{
					id: 'lesson-1',
					moduleId: 'module-1',
					title: 'Lesson 1',
					content: 'Content 1',
					duration: 1,
					order: 1,
					createdAt: new Date(),
					updatedAt: new Date(),
					specPoints: []
				},
				{
					id: 'lesson-2',
					moduleId: 'module-1',
					title: 'Lesson 2',
					content: 'Content 2',
					duration: 1,
					order: 2,
					createdAt: new Date(),
					updatedAt: new Date(),
					specPoints: []
				},
				{
					id: 'lesson-3',
					moduleId: 'module-1',
					title: 'Lesson 3',
					content: 'Content 3',
					duration: 1,
					order: 3,
					createdAt: new Date(),
					updatedAt: new Date(),
					specPoints: []
				}
			],
			examSpecs: [],
			specPoints: [],
			moduleAttachments: [],
			lessonAttachmentCounts: {}
		};
	});

	it('should render lessons with draggable attribute', () => {
		render(ModulePage, { props: { data: mockData, form: null } });

		const lessonCards = document.querySelectorAll('.draggable');
		expect(lessonCards).toHaveLength(3);

		lessonCards.forEach((card) => {
			expect(card).toHaveAttribute('draggable', 'true');
			expect(card).toHaveClass('draggable');
		});
	});

	it('should render lessons in correct order', () => {
		render(ModulePage, { props: { data: mockData, form: null } });

		const lessonTitles = screen.getAllByRole('heading', { level: 3 });
		expect(lessonTitles[0]).toHaveTextContent('1. Lesson 1');
		expect(lessonTitles[1]).toHaveTextContent('2. Lesson 2');
		expect(lessonTitles[2]).toHaveTextContent('3. Lesson 3');
	});

	it('should have keyboard accessibility attributes', () => {
		render(ModulePage, { props: { data: mockData, form: null } });

		const lessonCards = screen.getAllByRole('button');
		lessonCards.forEach((card) => {
			if (card.classList.contains('draggable')) {
				expect(card).toHaveAttribute('tabindex', '0');
				expect(card.getAttribute('aria-label')).toContain('Press Space or Enter to reorder');
			}
		});
	});

	it('should have draggable class for visual styling', () => {
		render(ModulePage, { props: { data: mockData, form: null } });

		const draggableCards = document.querySelectorAll('.draggable');
		expect(draggableCards.length).toBeGreaterThan(0);

		draggableCards.forEach((card) => {
			expect(card).toHaveClass('draggable');
		});
	});

	it('should have correct ARIA attributes for accessibility', () => {
		render(ModulePage, { props: { data: mockData, form: null } });

		const draggableCards = document.querySelectorAll('.draggable');
		draggableCards.forEach((card) => {
			expect(card).toHaveAttribute('aria-grabbed');
			expect(card.getAttribute('aria-label')).toBeTruthy();
		});
	});
});
