import { describe, it, expect } from 'vitest';
import { planModuleAssignment } from './scheduler';
import type { PeriodOccurrence, LessonData } from './types';

const stream: PeriodOccurrence[] = [
	{ date: '2026-09-14', period: 1, room: 'S1' },
	{ date: '2026-09-15', period: 2, room: 'S1' },
	{ date: '2026-09-16', period: 3, room: 'S2' },
	{ date: '2026-09-17', period: 1, room: 'S1' }
];

const lessons: LessonData[] = [
	{ id: 101, title: 'L1' },
	{ id: 102, title: 'L2' }
];

describe('planModuleAssignment', () => {
	it('places lessons into the first periods on/after notBefore', () => {
		const plan = planModuleAssignment(stream, lessons, { notBefore: '2026-09-14' });
		expect(plan.unscheduledCount).toBe(0);
		expect(plan.placements).toEqual([
			{ lessonId: 101, date: '2026-09-14', period: 1, title: 'L1', room: 'S1' },
			{ lessonId: 102, date: '2026-09-15', period: 2, title: 'L2', room: 'S1' }
		]);
	});

	it('starts strictly after the last scheduled lesson (append)', () => {
		const plan = planModuleAssignment(stream, lessons, {
			notBefore: '2026-09-14',
			lastScheduled: { date: '2026-09-15', period: 2 }
		});
		expect(plan.placements.map((p) => p.date)).toEqual(['2026-09-16', '2026-09-17']);
	});

	it('ignores periods before notBefore (next teaching day)', () => {
		const plan = planModuleAssignment(stream, lessons, { notBefore: '2026-09-16' });
		expect(plan.placements.map((p) => p.date)).toEqual(['2026-09-16', '2026-09-17']);
	});

	it('reports lessons that did not fit', () => {
		const many: LessonData[] = [
			{ id: 1, title: 'a' },
			{ id: 2, title: 'b' },
			{ id: 3, title: 'c' },
			{ id: 4, title: 'd' },
			{ id: 5, title: 'e' }
		];
		const plan = planModuleAssignment(stream, many, { notBefore: '2026-09-14' });
		expect(plan.placements).toHaveLength(4);
		expect(plan.unscheduledCount).toBe(1);
	});
});
