import { describe, it, expect } from 'vitest';
import { resolveWeekLetters, weekLetterForDate } from './week-letter';

describe('resolveWeekLetters', () => {
	it('alternates A/B across consecutive teaching weeks', () => {
		const teaching = ['2026-09-14', '2026-09-21', '2026-09-28']; // 3 Mondays, 3 weeks
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('B');
		expect(map.get('2026-09-28')).toBe('A');
	});

	it('skips a fully empty week so the cycle resumes (A, holiday, B)', () => {
		// Week of 14th has teaching, week of 21st is holiday (no teaching days),
		// week of 28th has teaching -> should be B, not A.
		const teaching = ['2026-09-14', '2026-09-28'];
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.has('2026-09-21')).toBe(false);
		expect(map.get('2026-09-28')).toBe('B');
	});

	it('a partial week still consumes a letter', () => {
		// Week of 14th has only Mon/Tue (rest closure), still counts as A;
		// next teaching week is B.
		const teaching = ['2026-09-14', '2026-09-15', '2026-09-21'];
		const map = resolveWeekLetters(2, 'A', teaching);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('B');
	});

	it('honours the anchor letter', () => {
		const map = resolveWeekLetters(2, 'B', ['2026-09-14', '2026-09-21']);
		expect(map.get('2026-09-14')).toBe('B');
		expect(map.get('2026-09-21')).toBe('A');
	});

	it('a 1-week cycle is always A', () => {
		const map = resolveWeekLetters(1, 'A', ['2026-09-14', '2026-09-21']);
		expect(map.get('2026-09-14')).toBe('A');
		expect(map.get('2026-09-21')).toBe('A');
	});

	it('weekLetterForDate maps any date via its Monday', () => {
		const map = resolveWeekLetters(2, 'A', ['2026-09-14', '2026-09-21']);
		expect(weekLetterForDate('2026-09-16', map)).toBe('A'); // Wed of week A
		expect(weekLetterForDate('2026-09-23', map)).toBe('B'); // Wed of week B
		expect(weekLetterForDate('2026-12-25', map)).toBeNull();
	});
});
