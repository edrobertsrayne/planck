import { db } from '$lib/server/db';
import {
	teachingClass,
	timetableSlot,
	timetableConfig,
	scheduledLesson,
	moduleAssignment,
	calendarEvent
} from '$lib/server/db/schema';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { getTimetableWeeksConfig } from '$lib/server/utils/week-calculator';

/**
 * Represents a scheduled lesson that needs to be rescheduled
 */
interface LessonToReschedule {
	id: string;
	assignmentId: string;
	lessonId: string;
	calendarDate: Date;
	timetableSlotId: string | null;
	title: string;
	content: string | null;
	duration: number;
	order: number;
	classId: string;
}

/**
 * Represents a timetable slot with its metadata
 */
interface TimetableSlotInfo {
	id: string;
	day: number;
	periodStart: number;
	periodEnd: number;
	week: 'A' | 'B' | null;
	duration: number;
	classId: string;
}

/**
 * Represents the result of a rescheduling operation
 */
export interface RescheduleResult {
	/** Number of lessons rescheduled */
	lessonsRescheduled: number;
	/** Array of lesson IDs that were rescheduled */
	rescheduledLessonIds: string[];
	/** Preview of changes (before and after dates) */
	changes: Array<{
		lessonId: string;
		title: string;
		oldDate: Date;
		newDate: Date;
	}>;
}

/**
 * Options for rescheduling lessons
 */
export interface RescheduleOptions {
	/** The calendar event that triggered the rescheduling */
	eventId: string;
	/** Whether to preview changes without applying them */
	preview?: boolean;
}

/**
 * Reschedules lessons affected by a calendar event
 * @param options Rescheduling options
 * @returns Result containing information about rescheduled lessons
 */
export async function rescheduleLessonsForEvent(
	options: RescheduleOptions
): Promise<RescheduleResult> {
	const { eventId, preview = false } = options;

	// Get the calendar event
	const events = await db.select().from(calendarEvent).where(eq(calendarEvent.id, eventId));

	if (events.length === 0) {
		throw new Error('Calendar event not found');
	}

	const event = events[0];

	// Normalize event dates to UTC midnight
	const eventStart = new Date(event.startDate);
	eventStart.setUTCHours(0, 0, 0, 0);
	const eventEnd = new Date(event.endDate);
	eventEnd.setUTCHours(0, 0, 0, 0);

	// Find all scheduled lessons that fall within the event date range
	const affectedLessons = await findAffectedLessons(eventStart, eventEnd);

	if (affectedLessons.length === 0) {
		return {
			lessonsRescheduled: 0,
			rescheduledLessonIds: [],
			changes: []
		};
	}

	// Group lessons by class
	const lessonsByClass = new Map<string, LessonToReschedule[]>();
	for (const lesson of affectedLessons) {
		if (!lessonsByClass.has(lesson.classId)) {
			lessonsByClass.set(lesson.classId, []);
		}
		lessonsByClass.get(lesson.classId)!.push(lesson);
	}

	const allChanges: Array<{
		lessonId: string;
		title: string;
		oldDate: Date;
		newDate: Date;
	}> = [];
	const rescheduledIds: string[] = [];

	// Reschedule lessons for each class independently
	for (const [classId, lessons] of lessonsByClass) {
		// Sort lessons by date and order to maintain sequence
		const sortedLessons = lessons.sort((a, b) => {
			const dateCompare = a.calendarDate.getTime() - b.calendarDate.getTime();
			if (dateCompare !== 0) return dateCompare;
			return a.order - b.order;
		});

		// Get lessons that come after the affected lessons (to cascade)
		const lastAffectedDate = sortedLessons[sortedLessons.length - 1].calendarDate;
		const subsequentLessons = await findSubsequentLessons(classId, lastAffectedDate);

		// Combine affected and subsequent lessons
		const allLessonsToReschedule = [...sortedLessons, ...subsequentLessons];

		// Get class timetable configuration
		const classData = await db.select().from(teachingClass).where(eq(teachingClass.id, classId));
		if (classData.length === 0) continue;

		// Check year-specific config exists
		const configResult = await db
			.select()
			.from(timetableConfig)
			.where(eq(timetableConfig.academicYear, classData[0].academicYear));

		if (configResult.length === 0) continue;

		// Get GLOBAL config for weeks
		const weeksConfig = await getTimetableWeeksConfig(db);

		// Get timetable slots for the class
		const slots = await db
			.select()
			.from(timetableSlot)
			.where(eq(timetableSlot.classId, classId))
			.orderBy(asc(timetableSlot.day), asc(timetableSlot.periodStart));

		const slotsWithDuration: TimetableSlotInfo[] = slots.map((slot) => ({
			id: slot.id,
			day: slot.day,
			periodStart: slot.periodStart,
			periodEnd: slot.periodEnd,
			week: slot.week,
			duration: slot.periodEnd - slot.periodStart + 1,
			classId: slot.classId
		}));

		// Find the first affected lesson date
		const firstAffectedDate = sortedLessons[0].calendarDate;

		// Find the next available date after the event ends
		const searchStartDate = new Date(eventEnd);
		searchStartDate.setUTCDate(searchStartDate.getUTCDate() + 1);

		// Get all lessons scheduled before the first affected lesson (these stay in place)
		const unaffectedLessons = await db
			.select({
				calendarDate: scheduledLesson.calendarDate,
				timetableSlotId: scheduledLesson.timetableSlotId
			})
			.from(scheduledLesson)
			.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
			.where(
				and(
					eq(moduleAssignment.classId, classId),
					lte(scheduledLesson.calendarDate, firstAffectedDate)
				)
			);

		// Build occupied slots set (excluding lessons we're about to reschedule)
		const occupiedSlots = new Set(
			unaffectedLessons
				.filter((l) => l.timetableSlotId !== null)
				.map((l) => {
					const d = new Date(l.calendarDate);
					d.setUTCHours(0, 0, 0, 0);
					return `${d.toISOString()}-${l.timetableSlotId}`;
				})
		);

		// Get all calendar events that we need to avoid
		const allEvents = await db
			.select()
			.from(calendarEvent)
			.where(gte(calendarEvent.endDate, searchStartDate))
			.orderBy(asc(calendarEvent.startDate));

		// Schedule the lessons into new slots
		const newSchedule = scheduleLessonsFromDate(
			allLessonsToReschedule,
			slotsWithDuration,
			searchStartDate,
			weeksConfig,
			occupiedSlots,
			allEvents
		);

		// Record changes and update database if not in preview mode
		for (let i = 0; i < allLessonsToReschedule.length; i++) {
			const lesson = allLessonsToReschedule[i];
			const newSlot = newSchedule[i];

			allChanges.push({
				lessonId: lesson.id,
				title: lesson.title,
				oldDate: lesson.calendarDate,
				newDate: newSlot.date
			});

			rescheduledIds.push(lesson.id);

			// Update the lesson in the database if not previewing
			if (!preview) {
				await db
					.update(scheduledLesson)
					.set({
						calendarDate: newSlot.date,
						timetableSlotId: newSlot.slotId
					})
					.where(eq(scheduledLesson.id, lesson.id));
			}
		}
	}

	return {
		lessonsRescheduled: rescheduledIds.length,
		rescheduledLessonIds: rescheduledIds,
		changes: allChanges
	};
}

/**
 * Finds all lessons affected by a date range
 */
async function findAffectedLessons(startDate: Date, endDate: Date): Promise<LessonToReschedule[]> {
	const lessons = await db
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
			classId: moduleAssignment.classId
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.where(
			and(gte(scheduledLesson.calendarDate, startDate), lte(scheduledLesson.calendarDate, endDate))
		)
		.orderBy(asc(scheduledLesson.calendarDate), asc(scheduledLesson.order));

	return lessons;
}

/**
 * Finds all lessons that come after a given date for a class
 */
async function findSubsequentLessons(
	classId: string,
	afterDate: Date
): Promise<LessonToReschedule[]> {
	const lessons = await db
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
			classId: moduleAssignment.classId
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.where(and(eq(moduleAssignment.classId, classId), gte(scheduledLesson.calendarDate, afterDate)))
		.orderBy(asc(scheduledLesson.calendarDate), asc(scheduledLesson.order));

	// Filter out the lessons at exactly afterDate (those are already in affected lessons)
	return lessons.filter((lesson) => lesson.calendarDate.getTime() > afterDate.getTime());
}

/**
 * Schedules lessons from a given date, avoiding occupied slots and calendar events
 */
function scheduleLessonsFromDate(
	lessons: LessonToReschedule[],
	slots: TimetableSlotInfo[],
	startDate: Date,
	weekCycle: number,
	occupiedSlots: Set<string>,
	events: Array<{ startDate: Date; endDate: Date }>
): Array<{ date: Date; slotId: string }> {
	const result: Array<{ date: Date; slotId: string }> = [];

	// Create a set of dates blocked by events
	const blockedDates = new Set<string>();
	for (const event of events) {
		const eventStart = new Date(event.startDate);
		eventStart.setUTCHours(0, 0, 0, 0);
		const eventEnd = new Date(event.endDate);
		eventEnd.setUTCHours(0, 0, 0, 0);

		const current = new Date(eventStart);
		while (current <= eventEnd) {
			blockedDates.add(current.toISOString());
			current.setUTCDate(current.getUTCDate() + 1);
		}
	}

	const currentDate = new Date(startDate);
	currentDate.setUTCHours(0, 0, 0, 0);

	let lessonIndex = 0;
	const maxDays = 730; // 2 years max
	let daysSearched = 0;

	while (lessonIndex < lessons.length && daysSearched < maxDays) {
		const currentLesson = lessons[lessonIndex];

		// Check if this date is blocked by an event
		if (blockedDates.has(currentDate.toISOString())) {
			currentDate.setUTCDate(currentDate.getUTCDate() + 1);
			daysSearched++;
			continue;
		}

		const dayOfWeek = currentDate.getUTCDay();
		const ourDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

		let slotPlaced = false;

		for (const slot of slots) {
			if (slot.day !== ourDayOfWeek) continue;

			// For 2-week timetables, check week
			if (weekCycle === 2 && slot.week) {
				const weekNumber = getWeekNumber(currentDate, startDate);
				const isWeekA = weekNumber % 2 === 1;
				const currentWeek = isWeekA ? 'A' : 'B';

				if (slot.week !== currentWeek) continue;
			}

			// Check if slot duration matches lesson duration
			if (slot.duration !== currentLesson.duration) continue;

			// Check if this date-slot combination is not occupied
			const key = `${currentDate.toISOString()}-${slot.id}`;
			if (occupiedSlots.has(key)) continue;

			// This slot is suitable!
			result.push({
				date: new Date(currentDate),
				slotId: slot.id
			});

			// Mark this slot as occupied
			occupiedSlots.add(key);

			slotPlaced = true;
			lessonIndex++;
			break;
		}

		// Move to next day if no slot was placed
		if (!slotPlaced) {
			currentDate.setUTCDate(currentDate.getUTCDate() + 1);
			daysSearched++;
		}
	}

	// If we couldn't place all lessons, throw an error
	if (lessonIndex < lessons.length) {
		const unplacedLesson = lessons[lessonIndex];
		throw new Error(
			`Could not find a suitable slot for lesson "${unplacedLesson.title}". ` +
				`The lesson requires ${unplacedLesson.duration} period(s), but no matching slot is available.`
		);
	}

	return result;
}

/**
 * Calculates the week number relative to a start date
 */
function getWeekNumber(date: Date, startDate: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / msPerDay);
	return Math.floor(daysSinceStart / 7) + 1;
}
