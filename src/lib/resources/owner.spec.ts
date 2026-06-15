import { describe, it, expect } from 'vitest';
import { ownerColumns, type OwnerRef } from './owner';

describe('ownerColumns', () => {
	it('maps a template lesson owner to the lessonId column', () => {
		expect(ownerColumns({ lessonId: 7 })).toEqual({
			lessonId: 7,
			scheduledLessonId: null,
			courseId: null,
			moduleId: null
		});
	});

	it('maps a scheduled lesson owner to the scheduledLessonId column', () => {
		expect(ownerColumns({ scheduledLessonId: 9 })).toEqual({
			lessonId: null,
			scheduledLessonId: 9,
			courseId: null,
			moduleId: null
		});
	});

	it('maps a course owner to the courseId column', () => {
		expect(ownerColumns({ courseId: 3 })).toEqual({
			lessonId: null,
			scheduledLessonId: null,
			courseId: 3,
			moduleId: null
		});
	});

	it('maps a module owner to the moduleId column', () => {
		expect(ownerColumns({ moduleId: 5 })).toEqual({
			lessonId: null,
			scheduledLessonId: null,
			courseId: null,
			moduleId: 5
		});
	});

	it('throws when no id is provided', () => {
		expect(() => ownerColumns({} as OwnerRef)).toThrow(/exactly one/);
	});

	it('throws when more than one id is provided', () => {
		expect(() => ownerColumns({ lessonId: 1, courseId: 2 } as OwnerRef)).toThrow(/exactly one/);
	});
});
