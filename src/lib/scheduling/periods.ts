import { dayOfWeekIso, mondayOf, type IsoDate } from './dates';
import { listTeachingDays } from './teaching-days';
import { resolveWeekLetters } from './week-letter';
import type { TimetableConfigData, TeachingBlockData, SlotData, PeriodOccurrence } from './types';

export function classPeriodStream(
	config: TimetableConfigData,
	blocks: TeachingBlockData[],
	closures: IsoDate[],
	slots: SlotData[],
	classId: number
): PeriodOccurrence[] {
	const teachingDays = listTeachingDays(blocks, closures, config.teachingDays);
	const weekMap = resolveWeekLetters(config.cycleWeeks, config.anchorLetter, teachingDays);
	const classSlots = slots.filter((s) => s.classId === classId);

	const out: PeriodOccurrence[] = [];
	for (const date of teachingDays) {
		const letter = weekMap.get(mondayOf(date));
		if (!letter) continue;
		const dow = dayOfWeekIso(date);
		const todays = classSlots
			.filter((s) => s.weekLetter === letter && s.dayOfWeek === dow)
			.sort((a, b) => a.period - b.period);
		for (const s of todays) out.push({ date, period: s.period, room: s.room });
	}
	return out;
}
