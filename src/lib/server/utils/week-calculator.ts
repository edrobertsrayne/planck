import { calendarEvent, timetableConfig } from '$lib/server/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { db } from '$lib/server/db';

type Database = typeof db;

interface Holiday {
	startDate: Date;
	endDate: Date;
}

/**
 * Cache for school week calculations within a request
 * Key: ${academicYear}-${dateString}
 */
const weekCache = new Map<string, number>();

/**
 * Calculates the school week number for a given date, accounting for holidays.
 * Fully-covered holiday weeks (all 7 days within a holiday) are skipped and don't increment the week count.
 *
 * @param date The date to calculate the school week for
 * @param academicYear The academic year in format "YYYY-YY"
 * @param db Database connection
 * @returns The school week number (starts at 1)
 */
export async function getSchoolWeekNumber(
	date: Date,
	academicYear: string,
	db: Database
): Promise<number> {
	const dateStr = date.toISOString().split('T')[0];
	const cacheKey = `${academicYear}-${dateStr}`;

	// Check cache
	if (weekCache.has(cacheKey)) {
		return weekCache.get(cacheKey)!;
	}

	// Get the start of the academic year (September 1st)
	const [startYear] = academicYear.split('-');
	const academicYearStart = new Date(`${startYear}-09-01T00:00:00.000Z`);

	// Align to Monday of the week containing Sept 1st
	const startOfFirstWeek = getStartOfWeek(academicYearStart);

	// If the target date is before the academic year start, return 0
	if (date < startOfFirstWeek) {
		weekCache.set(cacheKey, 0);
		return 0;
	}

	// Fetch all holidays for this academic year
	const holidays = await fetchHolidays(academicYear, db);

	// Count school weeks from start to target date
	let schoolWeekNumber = 0;
	const currentWeekStart = new Date(startOfFirstWeek);

	while (currentWeekStart <= date) {
		// Check if this week is fully covered by a holiday
		const isFullyCovered = isWeekFullyCovered(currentWeekStart, holidays);

		if (!isFullyCovered) {
			schoolWeekNumber++;
		}

		// Move to next week
		currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 7);
	}

	weekCache.set(cacheKey, schoolWeekNumber);
	return schoolWeekNumber;
}

/**
 * Gets the Week A/B label for a given school week number
 * @param weekNumber The school week number
 * @returns 'A' for odd weeks, 'B' for even weeks
 */
export function getWeekLabel(weekNumber: number): 'A' | 'B' {
	return weekNumber % 2 === 1 ? 'A' : 'B';
}

/**
 * Checks if a week (Monday-Sunday) is fully covered by any holiday
 * @param weekStart The Monday of the week to check (must be a Monday)
 * @param holidays Array of holidays with start and end dates
 * @returns true if all 7 days of the week are within a holiday
 */
function isWeekFullyCovered(weekStart: Date, holidays: Holiday[]): boolean {
	// Generate all 7 days of this week
	const weekDays: Date[] = [];
	for (let i = 0; i < 7; i++) {
		const day = new Date(weekStart);
		day.setUTCDate(day.getUTCDate() + i);
		weekDays.push(day);
	}

	// Check if all 7 days are covered by at least one holiday
	return weekDays.every((day) =>
		holidays.some((holiday) => {
			const dayTime = day.getTime();
			const startTime = new Date(holiday.startDate).getTime();
			const endTime = new Date(holiday.endDate).getTime();
			return dayTime >= startTime && dayTime <= endTime;
		})
	);
}

/**
 * Fetches all holidays for a given academic year
 * @param academicYear Academic year in format "YYYY-YY"
 * @param db Database connection
 * @returns Array of holidays with start and end dates
 */
async function fetchHolidays(academicYear: string, db: Database): Promise<Holiday[]> {
	// Get academic year boundaries
	const [startYear] = academicYear.split('-');
	const academicYearStart = new Date(`${startYear}-09-01T00:00:00.000Z`);
	const academicYearEnd = new Date(`${parseInt(startYear) + 1}-08-31T23:59:59.999Z`);

	// Fetch holidays that overlap with this academic year
	const events = await db
		.select()
		.from(calendarEvent)
		.where(
			and(
				eq(calendarEvent.type, 'holiday'),
				lte(calendarEvent.startDate, academicYearEnd),
				gte(calendarEvent.endDate, academicYearStart)
			)
		);

	return events.map((event: { startDate: Date; endDate: Date }) => ({
		startDate: new Date(event.startDate),
		endDate: new Date(event.endDate)
	}));
}

/**
 * Gets the Monday of the week containing the given date
 * @param date The date to find the week start for
 * @returns The Monday of that week (UTC, 00:00:00)
 */
function getStartOfWeek(date: Date): Date {
	const d = new Date(date);
	const day = d.getUTCDay();
	const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
	d.setUTCDate(diff);
	d.setUTCHours(0, 0, 0, 0);
	return d;
}

/**
 * Gets the timetable weeks configuration (1 or 2) from GLOBAL config
 * @param db Database connection
 * @returns Number of weeks in timetable cycle (1 or 2)
 */
export async function getTimetableWeeksConfig(db: Database): Promise<number> {
	const globalConfigs = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.academicYear, 'GLOBAL'))
		.limit(1);

	return globalConfigs[0]?.weeks || 1;
}

/**
 * Clears the week calculation cache
 * Should be called at the start of each request or when holidays change
 */
export function clearWeekCache(): void {
	weekCache.clear();
}
