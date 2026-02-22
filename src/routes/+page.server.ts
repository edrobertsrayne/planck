import { db } from '$lib/server/db';
import {
	teachingClass,
	scheduledLesson,
	moduleAssignment,
	course,
	calendarEvent
} from '$lib/server/db/schema';
import { eq, and, gte, lte, asc, count } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	// Get current academic year
	const currentAcademicYear = getAcademicYear(today);

	// Get total classes for current year
	const classCountResult = await db
		.select({ count: count() })
		.from(teachingClass)
		.where(eq(teachingClass.academicYear, currentAcademicYear));
	const totalClasses = classCountResult[0]?.count || 0;

	// Get upcoming lessons this week
	const startOfWeek = getStartOfWeek(today);
	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);

	const upcomingLessonsResult = await db
		.select({ count: count() })
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.innerJoin(teachingClass, eq(moduleAssignment.classId, teachingClass.id))
		.where(
			and(
				eq(teachingClass.academicYear, currentAcademicYear),
				gte(scheduledLesson.calendarDate, startOfWeek),
				lte(scheduledLesson.calendarDate, endOfWeek)
			)
		);
	const upcomingLessonsThisWeek = upcomingLessonsResult[0]?.count || 0;

	// Get total courses
	const courseCountResult = await db.select({ count: count() }).from(course);
	const totalCourses = courseCountResult[0]?.count || 0;

	// Get next upcoming holiday
	const upcomingHolidays = await db
		.select()
		.from(calendarEvent)
		.where(and(eq(calendarEvent.type, 'holiday'), gte(calendarEvent.startDate, today)))
		.orderBy(asc(calendarEvent.startDate))
		.limit(1);

	const nextHoliday = upcomingHolidays[0] || null;

	// Get today's lessons
	const todaysLessons = await db
		.select({
			id: scheduledLesson.id,
			title: scheduledLesson.title,
			duration: scheduledLesson.duration,
			className: teachingClass.name,
			classYearGroup: teachingClass.yearGroup
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.innerJoin(teachingClass, eq(moduleAssignment.classId, teachingClass.id))
		.where(
			and(
				eq(teachingClass.academicYear, currentAcademicYear),
				eq(scheduledLesson.calendarDate, today)
			)
		)
		.orderBy(asc(scheduledLesson.order));

	return {
		academicYear: currentAcademicYear,
		stats: {
			totalClasses,
			upcomingLessonsThisWeek,
			totalCourses,
			nextHoliday
		},
		todaysLessons
	};
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
