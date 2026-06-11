import { describe, it, expect } from 'vitest';
import { addDays, dayOfWeekIso, mondayOf, eachDate, isWeekday } from './dates';

describe('dates', () => {
	it('addDays crosses month boundaries', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('dayOfWeekIso returns 1=Mon..7=Sun', () => {
		expect(dayOfWeekIso('2026-09-14')).toBe(1); // Monday
		expect(dayOfWeekIso('2026-09-20')).toBe(7); // Sunday
	});

	it('mondayOf snaps to the ISO week start', () => {
		expect(mondayOf('2026-09-16')).toBe('2026-09-14'); // Wed -> Mon
		expect(mondayOf('2026-09-14')).toBe('2026-09-14'); // Mon -> Mon
		expect(mondayOf('2026-09-20')).toBe('2026-09-14'); // Sun -> Mon
	});

	it('eachDate is inclusive of both ends', () => {
		expect(eachDate('2026-09-14', '2026-09-16')).toEqual([
			'2026-09-14',
			'2026-09-15',
			'2026-09-16'
		]);
	});

	it('isWeekday is false at weekends', () => {
		expect(isWeekday('2026-09-14')).toBe(true);
		expect(isWeekday('2026-09-19')).toBe(false); // Saturday
	});
});
