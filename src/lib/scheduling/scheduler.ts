import type { IsoDate } from './dates';
import type { PeriodOccurrence, LessonData, AssignmentPlan, Placement } from './types';

interface PlanOptions {
	/** Earliest date a lesson may be placed (the next teaching day). */
	notBefore: IsoDate;
	/** The class's last already-scheduled lesson, if any. */
	lastScheduled?: { date: IsoDate; period: number };
}

function isAfter(o: PeriodOccurrence, ref: { date: IsoDate; period: number }): boolean {
	return o.date > ref.date || (o.date === ref.date && o.period > ref.period);
}

export function planModuleAssignment(
	stream: PeriodOccurrence[],
	lessons: LessonData[],
	options: PlanOptions
): AssignmentPlan {
	const available = stream.filter((o) => {
		if (o.date < options.notBefore) return false;
		if (options.lastScheduled && !isAfter(o, options.lastScheduled)) return false;
		return true;
	});

	const placements: Placement[] = [];
	for (let i = 0; i < lessons.length && i < available.length; i++) {
		const slot = available[i];
		const lesson = lessons[i];
		placements.push({
			lessonId: lesson.id,
			date: slot.date,
			period: slot.period,
			title: lesson.title,
			room: slot.room
		});
	}

	return { placements, unscheduledCount: lessons.length - placements.length };
}
