import { describe, it, expect } from 'vitest';
import {
	addDays,
	dayOfWeekIso,
	mondayOf,
	eachDate,
	isWeekday,
	daysInMonth,
	academicYearCutoff
} from './dates';

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

describe('daysInMonth', () => {
	it('returns month lengths, Feb as 29 (leap-tolerant)', () => {
		expect(daysInMonth(1)).toBe(31);
		expect(daysInMonth(2)).toBe(29);
		expect(daysInMonth(4)).toBe(30);
		expect(daysInMonth(12)).toBe(31);
	});
});

describe('academicYearCutoff', () => {
	it('returns the previous academic-year start (default 1 Sept)', () => {
		expect(academicYearCutoff('2026-06-18', 9, 1)).toBe('2024-09-01');
	});

	it('rolls forward once today reaches the start date', () => {
		expect(academicYearCutoff('2026-09-01', 9, 1)).toBe('2025-09-01');
		expect(academicYearCutoff('2026-10-15', 9, 1)).toBe('2025-09-01');
		expect(academicYearCutoff('2026-08-31', 9, 1)).toBe('2024-09-01');
	});

	it('handles a January start', () => {
		expect(academicYearCutoff('2026-06-18', 1, 1)).toBe('2025-01-01');
	});

	it('clamps a 29-Feb start into a non-leap cutoff year', () => {
		expect(academicYearCutoff('2026-06-18', 2, 29)).toBe('2025-02-28');
	});

	it('keeps 29 Feb when the cutoff year is a leap year', () => {
		expect(academicYearCutoff('2025-06-18', 2, 29)).toBe('2024-02-29');
	});
});
