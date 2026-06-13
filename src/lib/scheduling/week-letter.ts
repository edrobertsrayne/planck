import { mondayOf, type IsoDate } from './dates';
import type { WeekLetter } from './types';

/**
 * Assigns a WeekLetter to every Monday that begins a teaching week.
 * The cycle advances once per teaching week, in date order. Weeks with no
 * teaching days never appear in `teachingDays` and are therefore skipped.
 */
export function resolveWeekLetters(
	cycleWeeks: 1 | 2,
	anchorLetter: WeekLetter,
	teachingDays: IsoDate[]
): Map<IsoDate, WeekLetter> {
	const mondays: IsoDate[] = [];
	const seen = new Set<IsoDate>();
	for (const d of teachingDays) {
		const m = mondayOf(d);
		if (!seen.has(m)) {
			seen.add(m);
			mondays.push(m);
		}
	}
	mondays.sort();

	const map = new Map<IsoDate, WeekLetter>();
	if (cycleWeeks === 1) {
		for (const m of mondays) map.set(m, 'A');
		return map;
	}

	const other: WeekLetter = anchorLetter === 'A' ? 'B' : 'A';
	mondays.forEach((m, i) => map.set(m, i % 2 === 0 ? anchorLetter : other));
	return map;
}

export function weekLetterForDate(d: IsoDate, map: Map<IsoDate, WeekLetter>): WeekLetter | null {
	return map.get(mondayOf(d)) ?? null;
}
