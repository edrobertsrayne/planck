import { db } from '$lib/server/db';
import {
	teachingClass,
	timetableConfig,
	timetableSlot,
	scheduledLesson,
	moduleAssignment,
	calendarEvent,
	course
} from '$lib/server/db/schema';
import { eq, and, asc, gte, lte } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import {
	getSchoolWeekNumber,
	getWeekLabel,
	getTimetableWeeksConfig
} from '$lib/server/utils/week-calculator';

export const load: PageServerLoad = async ({ url }) => {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	const viewParam = url.searchParams.get('view')?.toLowerCase();
	const view: 'day' | 'week' | 'term' =
		viewParam === 'week' || viewParam === 'term' ? viewParam : 'day';

	const dateParam = url.searchParams.get('date');
	let currentDate: Date;

	if (dateParam) {
		currentDate = new Date(dateParam);
		if (isNaN(currentDate.getTime())) {
			currentDate = today;
		}
	} else {
		currentDate = today;
	}
	currentDate.setUTCHours(0, 0, 0, 0);

	const currentAcademicYear = getAcademicYear(currentDate);

	// Get year-specific config for periods/days
	const configResult = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.academicYear, currentAcademicYear))
		.limit(1);

	const timetableConfigData = configResult[0] || null;

	// Get GLOBAL config for weeks
	const weeksConfig = await getTimetableWeeksConfig(db);

	const classes = await db
		.select({
			id: teachingClass.id,
			name: teachingClass.name,
			yearGroup: teachingClass.yearGroup,
			academicYear: teachingClass.academicYear,
			course: {
				id: course.id,
				name: course.name
			}
		})
		.from(teachingClass)
		.leftJoin(course, eq(teachingClass.courseId, course.id))
		.where(eq(teachingClass.academicYear, currentAcademicYear))
		.orderBy(asc(teachingClass.name));

	const classIds = classes.map((c) => c.id);

	let dateRange: { start: Date; end: Date };

	if (view === 'day') {
		dateRange = { start: currentDate, end: currentDate };
	} else if (view === 'week') {
		const startOfWeek = getStartOfWeek(currentDate);
		const endOfWeek = new Date(startOfWeek);
		const numWeeks = weeksConfig === 2 ? 2 : 1;
		endOfWeek.setUTCDate(endOfWeek.getUTCDate() + numWeeks * 7 - 1);
		dateRange = { start: startOfWeek, end: endOfWeek };
	} else {
		const startOfTerm = getStartOfTerm(currentDate);
		const endOfTerm = getEndOfTerm(currentDate);
		dateRange = { start: startOfTerm, end: endOfTerm };
	}

	const events = await db
		.select()
		.from(calendarEvent)
		.where(
			and(lte(calendarEvent.startDate, dateRange.end), gte(calendarEvent.endDate, dateRange.start))
		)
		.orderBy(asc(calendarEvent.startDate));

	const slots =
		classIds.length > 0
			? await db
					.select()
					.from(timetableSlot)
					.orderBy(asc(timetableSlot.day), asc(timetableSlot.periodStart))
			: [];

	const scheduled = await db
		.select({
			id: scheduledLesson.id,
			assignmentId: scheduledLesson.assignmentId,
			lessonId: scheduledLesson.lessonId,
			calendarDate: scheduledLesson.calendarDate,
			timetableSlotId: scheduledLesson.timetableSlotId,
			title: scheduledLesson.title,
			content: scheduledLesson.content,
			duration: scheduledLesson.duration,
			order: scheduledLesson.order,
			classId: moduleAssignment.classId,
			className: teachingClass.name,
			classYearGroup: teachingClass.yearGroup
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.innerJoin(teachingClass, eq(moduleAssignment.classId, teachingClass.id))
		.where(
			and(
				gte(scheduledLesson.calendarDate, dateRange.start),
				lte(scheduledLesson.calendarDate, dateRange.end)
			)
		)
		.orderBy(asc(scheduledLesson.calendarDate), asc(scheduledLesson.order));

	const classColors = generateClassColors(classes);

	// Calculate school week number and label for current date
	const schoolWeekNumber = await getSchoolWeekNumber(currentDate, currentAcademicYear, db);
	const weekLabel = getWeekLabel(schoolWeekNumber);

	return {
		view,
		currentDate: currentDate.toISOString(),
		timetableConfig: timetableConfigData,
		weeksConfig,
		classes,
		slots,
		scheduledLessons: scheduled,
		events,
		classColors,
		academicYear: currentAcademicYear,
		currentWeekNumber: schoolWeekNumber,
		currentWeekLabel: weekLabel
	};
};

export const actions: Actions = {
	navigate: async ({ request }) => {
		const data = await request.formData();
		const direction = data.get('direction')?.toString();
		const view = (data.get('view')?.toString() || 'day') as 'day' | 'week' | 'term';
		const currentDateStr = data.get('currentDate')?.toString();

		if (!direction || !currentDateStr) {
			return { error: 'Missing navigation parameters' };
		}

		const currentDate = new Date(currentDateStr);
		currentDate.setUTCHours(0, 0, 0, 0);

		const newDate = new Date(currentDate);

		if (view === 'day') {
			newDate.setUTCDate(newDate.getUTCDate() + (direction === 'next' ? 1 : -1));
		} else if (view === 'week') {
			const weeksConfig = await getTimetableWeeksConfig(db);
			const daysToMove = (direction === 'next' ? 1 : -1) * weeksConfig * 7;
			newDate.setUTCDate(newDate.getUTCDate() + daysToMove);
		} else {
			if (direction === 'next') {
				newDate.setMonth(newDate.getMonth() + 3);
			} else {
				newDate.setMonth(newDate.getMonth() - 3);
			}
		}

		return {
			success: true,
			newDate: newDate.toISOString(),
			view
		};
	},

	setView: async ({ request }) => {
		const data = await request.formData();
		const view = (data.get('view')?.toString() || 'day') as 'day' | 'week' | 'term';
		const currentDateStr = data.get('currentDate')?.toString();

		const currentDate = currentDateStr ? new Date(currentDateStr) : new Date();
		currentDate.setUTCHours(0, 0, 0, 0);

		return {
			success: true,
			newDate: currentDate.toISOString(),
			view
		};
	}
};

function getAcademicYear(date: Date): string {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();

	if (month >= 8) {
		return `${year}-${(year + 1).toString().slice(-2)}`;
	}
	return `${year - 1}-${year.toString().slice(-2)}`;
}

function getStartOfWeek(date: Date): Date {
	const d = new Date(date);
	const day = d.getUTCDay();
	const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
	d.setUTCDate(diff);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

function getStartOfTerm(date: Date): Date {
	const month = date.getUTCMonth();
	let startMonth: number;

	if (month >= 8 || month <= 0) {
		startMonth = 8;
	} else if (month <= 3) {
		startMonth = 0;
	} else {
		startMonth = 3;
	}

	const result = new Date(date);
	result.setUTCMonth(startMonth);
	result.setUTCDate(1);
	result.setUTCHours(0, 0, 0, 0);
	return result;
}

function getEndOfTerm(date: Date): Date {
	const month = date.getUTCMonth();
	let endMonth: number;

	if (month >= 8 || month <= 0) {
		endMonth = 11;
	} else if (month <= 3) {
		endMonth = 2;
	} else {
		endMonth = 6;
	}

	const result = new Date(date);
	result.setUTCMonth(endMonth + 1);
	result.setUTCDate(0);
	result.setUTCHours(23, 59, 59, 999);
	return result;
}

function generateClassColors(classes: Array<{ id: string }>): Map<string, string> {
	const colors = [
		'bg-blue-100 border-blue-300 text-blue-800',
		'bg-green-100 border-green-300 text-green-800',
		'bg-purple-100 border-purple-300 text-purple-800',
		'bg-orange-100 border-orange-300 text-orange-800',
		'bg-pink-100 border-pink-300 text-pink-800',
		'bg-teal-100 border-teal-300 text-teal-800',
		'bg-indigo-100 border-indigo-300 text-indigo-800',
		'bg-amber-100 border-amber-300 text-amber-800',
		'bg-cyan-100 border-cyan-300 text-cyan-800',
		'bg-rose-100 border-rose-300 text-rose-800'
	];

	const colorMap = new Map<string, string>();
	classes.forEach((cls, index) => {
		colorMap.set(cls.id, colors[index % colors.length]);
	});
	return colorMap;
}
