import { db } from '$lib/server/db';
import {
	teachingClass,
	module,
	lesson,
	timetableSlot,
	timetableConfig,
	moduleAssignment,
	scheduledLesson
} from '$lib/server/db/schema';
import { eq, and, asc, gte } from 'drizzle-orm';
import { getTimetableWeeksConfig } from '$lib/server/utils/week-calculator';

/**
 * Options for assigning a module to a class
 */
export interface AssignModuleOptions {
	classId: string;
	moduleId: string;
	/** Start date for the assignment. If not provided, uses next available slot */
	startDate?: Date;
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
	duration: number; // Calculated as periodEnd - periodStart + 1
}

/**
 * Represents an occupied slot (date + timetable slot)
 */
interface OccupiedSlot {
	date: Date;
	slotId: string;
}

/**
 * Assigns a module to a class, creating scheduled lessons
 * @param options Assignment options including class, module, and optional start date
 * @throws Error if validation fails or scheduling is not possible
 */
export async function assignModuleToClass(options: AssignModuleOptions): Promise<string> {
	const { classId, moduleId, startDate } = options;

	// Validate class exists
	const classes = await db.select().from(teachingClass).where(eq(teachingClass.id, classId));
	if (classes.length === 0) {
		throw new Error('Class not found');
	}
	const classData = classes[0];

	// Validate module exists
	const modules = await db.select().from(module).where(eq(module.id, moduleId));
	if (modules.length === 0) {
		throw new Error('Module not found');
	}

	// Check that year-specific timetable config exists
	const configs = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.academicYear, classData.academicYear));

	if (configs.length === 0) {
		throw new Error('Timetable configuration not found for academic year');
	}

	// Get GLOBAL config for weeks
	const weeksConfig = await getTimetableWeeksConfig(db);

	// Get timetable slots for the class
	const slots = await db
		.select()
		.from(timetableSlot)
		.where(eq(timetableSlot.classId, classId))
		.orderBy(asc(timetableSlot.day), asc(timetableSlot.periodStart));

	if (slots.length === 0) {
		throw new Error('Class has no timetable slots configured');
	}

	// Process slots to include duration
	const slotsWithDuration: TimetableSlotInfo[] = slots.map((slot) => ({
		id: slot.id,
		day: slot.day,
		periodStart: slot.periodStart,
		periodEnd: slot.periodEnd,
		week: slot.week,
		duration: slot.periodEnd - slot.periodStart + 1
	}));

	// Get lessons from the module in order
	const lessons = await db
		.select()
		.from(lesson)
		.where(eq(lesson.moduleId, moduleId))
		.orderBy(asc(lesson.order));

	if (lessons.length === 0) {
		throw new Error('Module has no lessons to schedule');
	}

	// Determine the actual start date
	const actualStartDate = startDate || (await findNextAvailableSlot(classId, new Date()));

	// Get existing occupied slots for this class
	const occupiedSlots = await getOccupiedSlots(classId, actualStartDate);

	// Schedule lessons into slots
	const scheduledDates = scheduleLessons(
		lessons,
		slotsWithDuration,
		actualStartDate,
		weeksConfig,
		occupiedSlots
	);

	// Create module assignment record
	const assignment = await db
		.insert(moduleAssignment)
		.values({
			classId,
			moduleId,
			startDate: actualStartDate
		})
		.returning();

	const assignmentId = assignment[0].id;

	// Create scheduled lessons
	for (let i = 0; i < lessons.length; i++) {
		const lessonData = lessons[i];
		const { date, slotId } = scheduledDates[i];

		await db.insert(scheduledLesson).values({
			assignmentId,
			lessonId: lessonData.id,
			calendarDate: date,
			timetableSlotId: slotId,
			title: lessonData.title,
			content: lessonData.content,
			duration: lessonData.duration,
			order: lessonData.order
		});
	}

	return assignmentId;
}

/**
 * Finds the next available timetable slot date for a class
 * @param classId The class ID
 * @param fromDate The date to start searching from (defaults to today)
 * @returns The date of the next available slot
 */
export async function findNextAvailableSlot(
	classId: string,
	fromDate: Date = new Date()
): Promise<Date> {
	// Get timetable slots for the class
	const slots = await db
		.select()
		.from(timetableSlot)
		.where(eq(timetableSlot.classId, classId))
		.orderBy(asc(timetableSlot.day), asc(timetableSlot.periodStart));

	if (slots.length === 0) {
		throw new Error('Class has no timetable slots configured');
	}

	// Get the class to find academic year
	const classes = await db.select().from(teachingClass).where(eq(teachingClass.id, classId));
	if (classes.length === 0) {
		throw new Error('Class not found');
	}

	// Get GLOBAL config for weeks
	const weeksConfig = await getTimetableWeeksConfig(db);

	// Start from the beginning of fromDate (use UTC to avoid timezone issues)
	const searchDate = new Date(fromDate);
	searchDate.setUTCHours(0, 0, 0, 0);

	// Get occupied slots
	const occupiedSlots = await getOccupiedSlots(classId, searchDate);
	const occupiedDates = new Set(
		occupiedSlots.map((slot) => {
			const d = new Date(slot.date);
			d.setUTCHours(0, 0, 0, 0);
			return d.toISOString();
		})
	);

	// Search for the next available slot (limit search to 365 days)
	for (let daysAhead = 0; daysAhead < 365; daysAhead++) {
		const candidateDate = new Date(searchDate);
		candidateDate.setUTCDate(candidateDate.getUTCDate() + daysAhead);
		const dayOfWeek = candidateDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

		// Convert JavaScript day (0-6, Sun-Sat) to our format (1-7, Mon-Sun)
		const ourDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

		// Check if this day has any slots
		let hasSlotThisDay = false;

		for (const slot of slots) {
			if (slot.day !== ourDayOfWeek) continue;

			// For 2-week timetables, check week
			if (weeksConfig === 2 && slot.week) {
				const weekNumber = getWeekNumber(candidateDate, searchDate);
				const isWeekA = weekNumber % 2 === 1;
				const slotWeek = isWeekA ? 'A' : 'B';

				if (slot.week !== slotWeek) continue;
			}

			hasSlotThisDay = true;

			// Check if this date is not occupied
			const dateKeyCopy = new Date(candidateDate);
			dateKeyCopy.setUTCHours(0, 0, 0, 0);
			const dateKey = dateKeyCopy.toISOString();
			if (!occupiedDates.has(dateKey)) {
				return candidateDate;
			}
		}

		// If we found a slot this day but it was occupied, move to next day
		if (hasSlotThisDay) {
			continue;
		}
	}

	throw new Error('Could not find an available slot within the next year');
}

/**
 * Gets all occupied slots for a class from a given date onwards
 */
async function getOccupiedSlots(classId: string, fromDate: Date): Promise<OccupiedSlot[]> {
	const scheduled = await db
		.select({
			date: scheduledLesson.calendarDate,
			slotId: scheduledLesson.timetableSlotId
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.where(and(eq(moduleAssignment.classId, classId), gte(scheduledLesson.calendarDate, fromDate)));

	return scheduled
		.filter((s) => s.slotId !== null)
		.map((s) => {
			// Normalize date to UTC midnight
			const d = new Date(s.date);
			d.setUTCHours(0, 0, 0, 0);
			return {
				date: d,
				slotId: s.slotId!
			};
		});
}

/**
 * Schedules lessons into timetable slots
 */
function scheduleLessons(
	lessons: Array<{ id: string; title: string; duration: number; order: number }>,
	slots: TimetableSlotInfo[],
	startDate: Date,
	weekCycle: number,
	occupiedSlots: OccupiedSlot[]
): Array<{ date: Date; slotId: string }> {
	const result: Array<{ date: Date; slotId: string }> = [];

	const occupiedSet = new Set(
		occupiedSlots.map((o) => {
			const d = new Date(o.date);
			d.setUTCHours(0, 0, 0, 0);
			return `${d.toISOString()}-${o.slotId}`;
		})
	);

	const currentDate = new Date(startDate);
	currentDate.setUTCHours(0, 0, 0, 0);

	let lessonIndex = 0;
	const maxDays = 365;
	let daysSearched = 0;

	while (lessonIndex < lessons.length && daysSearched < maxDays) {
		const currentLesson = lessons[lessonIndex];
		const dayOfWeek = currentDate.getUTCDay();
		const ourDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

		let slotPlaced = false;

		for (const slot of slots) {
			if (slot.day !== ourDayOfWeek) continue;

			if (weekCycle === 2 && slot.week) {
				const weekNumber = getWeekNumber(currentDate, startDate);
				const isWeekA = weekNumber % 2 === 1;
				const currentWeek = isWeekA ? 'A' : 'B';
				if (slot.week !== currentWeek) continue;
			}

			if (slot.duration !== currentLesson.duration) continue;

			const key = `${currentDate.toISOString()}-${slot.id}`;
			if (occupiedSet.has(key)) continue;

			result.push({
				date: new Date(currentDate),
				slotId: slot.id
			});

			occupiedSet.add(key);
			slotPlaced = true;
			lessonIndex++;
			break;
		}

		if (!slotPlaced) {
			currentDate.setUTCDate(currentDate.getUTCDate() + 1);
			daysSearched++;
		}
	}

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
