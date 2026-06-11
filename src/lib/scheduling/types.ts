import type { IsoDate, DayOfWeek } from './dates';

export type WeekLetter = 'A' | 'B';

export interface TimetableConfigData {
	cycleWeeks: 1 | 2;
	teachingDays: DayOfWeek[]; // e.g. [1,2,3,4,5]
	periodsPerDay: number;
	anchorLetter: WeekLetter; // letter of the first teaching week
}

export interface TeachingBlockData {
	startDate: IsoDate;
	endDate: IsoDate;
}

export interface SlotData {
	weekLetter: WeekLetter;
	dayOfWeek: DayOfWeek;
	period: number;
	classId: number;
	room: string;
}

export interface PeriodOccurrence {
	date: IsoDate;
	period: number;
	room: string;
}

export interface LessonData {
	id: number;
	title: string;
}

export interface Placement {
	lessonId: number;
	date: IsoDate;
	period: number;
	title: string;
	room: string;
}

export interface AssignmentPlan {
	placements: Placement[];
	unscheduledCount: number;
}
