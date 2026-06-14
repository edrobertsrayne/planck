import { describe, it, expect } from 'vitest';
import { ownerColumns, type OwnerRef } from './owner';

describe('ownerColumns', () => {
	it('maps a template lesson owner to the lessonId column', () => {
		expect(ownerColumns({ lessonId: 7 })).toEqual({ lessonId: 7, scheduledLessonId: null });
	});

	it('maps a scheduled lesson owner to the scheduledLessonId column', () => {
		expect(ownerColumns({ scheduledLessonId: 9 })).toEqual({
			lessonId: null,
			scheduledLessonId: 9
		});
	});

	it('throws when neither id is provided', () => {
		expect(() => ownerColumns({} as OwnerRef)).toThrow(/exactly one/);
	});

	it('throws when both ids are provided', () => {
		expect(() => ownerColumns({ lessonId: 1, scheduledLessonId: 2 } as OwnerRef)).toThrow(
			/exactly one/
		);
	});
});
