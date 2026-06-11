import { eachDate, dayOfWeekIso, type IsoDate, type DayOfWeek } from './dates';
import type { TeachingBlockData } from './types';

export function listTeachingDays(
	blocks: TeachingBlockData[],
	closures: IsoDate[],
	teachingDays: DayOfWeek[]
): IsoDate[] {
	const closed = new Set(closures);
	const allowed = new Set(teachingDays);
	const days = new Set<IsoDate>();

	for (const block of blocks) {
		for (const d of eachDate(block.startDate, block.endDate)) {
			if (!allowed.has(dayOfWeekIso(d))) continue;
			if (closed.has(d)) continue;
			days.add(d);
		}
	}

	return [...days].sort();
}
