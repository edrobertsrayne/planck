import { describe, it, expect } from 'vitest';
import { listTeachingDays } from './teaching-days';

const teachingDays = [1, 2, 3, 4, 5] as const;

describe('listTeachingDays', () => {
	it('includes only configured weekdays inside blocks', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-20' }], // Mon..Sun
			[],
			[...teachingDays]
		);
		// Sat 19th and Sun 20th excluded
		expect(result).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
	});

	it('excludes closure days', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-18' }],
			['2026-09-16'],
			[...teachingDays]
		);
		expect(result).not.toContain('2026-09-16');
		expect(result).toHaveLength(4);
	});

	it('merges multiple blocks in date order and dedupes', () => {
		const result = listTeachingDays(
			[
				{ startDate: '2026-09-21', endDate: '2026-09-22' },
				{ startDate: '2026-09-14', endDate: '2026-09-15' }
			],
			[],
			[...teachingDays]
		);
		expect(result).toEqual(['2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22']);
	});

	it('respects a reduced teaching-day set', () => {
		const result = listTeachingDays(
			[{ startDate: '2026-09-14', endDate: '2026-09-18' }],
			[],
			[1, 3, 5] // Mon/Wed/Fri only
		);
		expect(result).toEqual(['2026-09-14', '2026-09-16', '2026-09-18']);
	});
});
