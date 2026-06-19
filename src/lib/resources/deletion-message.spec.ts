import { describe, it, expect } from 'vitest';
import { deletionMessage } from './deletion-message';

describe('deletionMessage', () => {
	it('describes a course/subject blast radius', () => {
		expect(deletionMessage('course', { classes: 3, scheduledLessons: 41, files: 12 })).toBe(
			'This deletes this subject, its 3 classes, 41 scheduled lessons and 12 files. This cannot be undone.'
		);
	});

	it('describes a class blast radius', () => {
		expect(deletionMessage('class', { scheduledLessons: 8, files: 2 })).toBe(
			'This deletes this class, 8 scheduled lessons and 2 files. This cannot be undone.'
		);
	});

	it('describes a module blast radius', () => {
		expect(deletionMessage('module', { lessons: 5, files: 0 })).toBe(
			'This deletes this module, its 5 lessons and 0 files. This cannot be undone.'
		);
	});

	it('uses singular nouns for a count of 1 (including "class")', () => {
		expect(deletionMessage('course', { classes: 1, scheduledLessons: 1, files: 1 })).toBe(
			'This deletes this subject, its 1 class, 1 scheduled lesson and 1 file. This cannot be undone.'
		);
	});
});
