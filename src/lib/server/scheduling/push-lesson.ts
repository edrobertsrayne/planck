import { db } from '$lib/server/db';
import {
	teachingClass,
	timetableSlot,
	timetableConfig,
	scheduledLesson,
	moduleAssignment,
	calendarEvent
} from '$lib/server/db/schema';
import { eq, and, gte, lte, asc, desc } from 'drizzle-orm';

/**
 * Direction to push a lesson
 */
export type PushDirection = 'forward' | 'back';

/**
 * Represents a scheduled lesson with class context
 */
interface ScheduledLessonWithClass {
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
 * Result of a push operation
 */
export interface PushResult {
	/** Number of lessons affected by the push */
	lessonsAffected: number;
	/** Array of lesson IDs that were moved */
	affectedLessonIds: string[];
	/** Preview of changes (before and after dates) */
	changes: Array<{
		lessonId: string;
		title: string;
		oldDate: Date;
		newDate: Date;
	}>;
}

/**
 * Options for pushing a lesson
 */
export interface PushOptions {
	/** ID of the lesson to push */
	lessonId: string;
	/** Direction to push the lesson */
	direction: PushDirection;
	/** Whether to preview changes without applying them */
	preview?: boolean;
}

/**
 * Pushes a scheduled lesson forward or backward in time
 * @param options Push options
 * @returns Result containing information about affected lessons
 */
export async function pushLesson(options: PushOptions): Promise<PushResult> {
	const { lessonId, direction, preview = false } = options;

	// Get the lesson to push
	const lessonData = await db
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
		.where(eq(scheduledLesson.id, lessonId));

	if (lessonData.length === 0) {
		throw new Error('Scheduled lesson not found');
	}

	const lesson = lessonData[0];
	const classId = lesson.classId;

	// Get class and timetable configuration
	const classData = await db.select().from(teachingClass).where(eq(teachingClass.id, classId));
	if (classData.length === 0) {
		throw new Error('Class not found');
	}

	const configResult = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.academicYear, classData[0].academicYear));

	if (configResult.length === 0) {
		throw new Error('Timetable configuration not found');
	}

	const config = configResult[0];

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

	// Get all calendar events to avoid
	const allEvents = await db.select().from(calendarEvent).orderBy(asc(calendarEvent.startDate));

	// Create a set of dates blocked by events
	const blockedDates = new Set<string>();
	for (const event of allEvents) {
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

	// Find the target lesson and all subsequent lessons (for forward) or previous lessons (for back)
	let lessonsToReschedule: ScheduledLessonWithClass[];

	if (direction === 'forward') {
		// Get the lesson being pushed and all lessons after it
		lessonsToReschedule = await db
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
				and(
					eq(moduleAssignment.classId, classId),
					gte(scheduledLesson.calendarDate, lesson.calendarDate)
				)
			)
			.orderBy(asc(scheduledLesson.calendarDate), asc(scheduledLesson.order));
	} else {
		// For backward push, get the lesson and all lessons before it
		lessonsToReschedule = await db
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
				and(
					eq(moduleAssignment.classId, classId),
					lte(scheduledLesson.calendarDate, lesson.calendarDate)
				)
			)
			.orderBy(desc(scheduledLesson.calendarDate), desc(scheduledLesson.order));

		// Reverse to get chronological order
		lessonsToReschedule.reverse();
	}

	if (lessonsToReschedule.length === 0) {
		return {
			lessonsAffected: 0,
			affectedLessonIds: [],
			changes: []
		};
	}

	// Get all lessons that should stay in place (those before the first lesson we're moving)
	const firstRescheduledDate = lessonsToReschedule[0].calendarDate;
	const unaffectedLessons = await db
		.select({
			id: scheduledLesson.id,
			calendarDate: scheduledLesson.calendarDate,
			timetableSlotId: scheduledLesson.timetableSlotId
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.where(
			and(
				eq(moduleAssignment.classId, classId),
				lte(scheduledLesson.calendarDate, firstRescheduledDate)
			)
		);

	// Build occupied slots set (excluding lessons we're about to reschedule)
	const rescheduledIds = new Set(lessonsToReschedule.map((l) => l.id));
	const occupiedSlots = new Set(
		unaffectedLessons
			.filter((l) => l.timetableSlotId !== null)
			.filter((l) => {
				// Exclude lessons that are being rescheduled
				return !rescheduledIds.has(l.id);
			})
			.map((l) => {
				const d = new Date(l.calendarDate);
				d.setUTCHours(0, 0, 0, 0);
				return `${d.toISOString()}-${l.timetableSlotId}`;
			})
	);

	// Find the next available slot
	let newSchedule: Array<{ date: Date; slotId: string }>;

	if (direction === 'forward') {
		// Start searching from the day after the current lesson
		const searchStart = new Date(lesson.calendarDate);
		searchStart.setUTCDate(searchStart.getUTCDate() + 1);
		searchStart.setUTCHours(0, 0, 0, 0);

		newSchedule = scheduleLessonsFromDate(
			lessonsToReschedule,
			slotsWithDuration,
			searchStart,
			config.weeks,
			occupiedSlots,
			blockedDates
		);
	} else {
		// For backward push, we need to find the previous available slot
		// Start searching from the day before the current lesson
		const searchStart = new Date(lesson.calendarDate);
		searchStart.setUTCDate(searchStart.getUTCDate() - 1);
		searchStart.setUTCHours(0, 0, 0, 0);

		newSchedule = scheduleLessonsBackwardFromDate(
			lessonsToReschedule,
			slotsWithDuration,
			searchStart,
			config.weeks,
			occupiedSlots,
			blockedDates
		);
	}

	// Record changes and update database if not in preview mode
	const changes: Array<{
		lessonId: string;
		title: string;
		oldDate: Date;
		newDate: Date;
	}> = [];
	const affectedIds: string[] = [];

	for (let i = 0; i < lessonsToReschedule.length; i++) {
		const lessonToUpdate = lessonsToReschedule[i];
		const newSlot = newSchedule[i];

		// Only record as change if the date actually changed
		if (lessonToUpdate.calendarDate.getTime() !== newSlot.date.getTime()) {
			changes.push({
				lessonId: lessonToUpdate.id,
				title: lessonToUpdate.title,
				oldDate: lessonToUpdate.calendarDate,
				newDate: newSlot.date
			});

			affectedIds.push(lessonToUpdate.id);

			// Update the lesson in the database if not previewing
			if (!preview) {
				await db
					.update(scheduledLesson)
					.set({
						calendarDate: newSlot.date,
						timetableSlotId: newSlot.slotId
					})
					.where(eq(scheduledLesson.id, lessonToUpdate.id));
			}
		}
	}

	return {
		lessonsAffected: affectedIds.length,
		affectedLessonIds: affectedIds,
		changes
	};
}

/**
 * Schedules lessons forward from a given date
 */
function scheduleLessonsFromDate(
	lessons: ScheduledLessonWithClass[],
	slots: TimetableSlotInfo[],
	startDate: Date,
	weekCycle: number,
	occupiedSlots: Set<string>,
	blockedDates: Set<string>
): Array<{ date: Date; slotId: string }> {
	const result: Array<{ date: Date; slotId: string }> = [];

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
 * Schedules lessons backward from a given date
 */
function scheduleLessonsBackwardFromDate(
	lessons: ScheduledLessonWithClass[],
	slots: TimetableSlotInfo[],
	startDate: Date,
	weekCycle: number,
	occupiedSlots: Set<string>,
	blockedDates: Set<string>
): Array<{ date: Date; slotId: string }> {
	const result: Array<{ date: Date; slotId: string }> = [];

	// Start from the end and work backwards
	const currentDate = new Date(startDate);
	currentDate.setUTCHours(0, 0, 0, 0);

	let lessonIndex = lessons.length - 1;
	const maxDays = 730; // 2 years max
	let daysSearched = 0;

	while (lessonIndex >= 0 && daysSearched < maxDays) {
		const currentLesson = lessons[lessonIndex];

		// Check if this date is blocked by an event
		if (blockedDates.has(currentDate.toISOString())) {
			currentDate.setUTCDate(currentDate.getUTCDate() - 1);
			daysSearched++;
			continue;
		}

		const dayOfWeek = currentDate.getUTCDay();
		const ourDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

		let slotPlaced = false;

		// Try slots in reverse order for consistency
		for (let i = slots.length - 1; i >= 0; i--) {
			const slot = slots[i];
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
			result.unshift({
				date: new Date(currentDate),
				slotId: slot.id
			});

			// Mark this slot as occupied
			occupiedSlots.add(key);

			slotPlaced = true;
			lessonIndex--;
			break;
		}

		// Move to previous day if no slot was placed
		if (!slotPlaced) {
			currentDate.setUTCDate(currentDate.getUTCDate() - 1);
			daysSearched++;
		}
	}

	// If we couldn't place all lessons, throw an error
	if (lessonIndex >= 0) {
		const unplacedLesson = lessons[lessonIndex];
		throw new Error(
			`Could not find a suitable slot for lesson "${unplacedLesson.title}" when pushing backward. ` +
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
