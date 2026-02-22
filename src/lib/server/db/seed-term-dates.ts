import { db } from './index';
import { calendarEvent } from './schema';
import { eq, and } from 'drizzle-orm';

export async function seedTermDates(academicYear: string) {
	// Parse the academic year (e.g., "2024-25" -> startYear: 2024, endYear: 2025)
	const [startYearStr, endYearSuffix] = academicYear.split('-');
	const startYear = parseInt(startYearStr, 10);
	const endYear = parseInt(`20${endYearSuffix}`, 10);

	// Helper to find or create calendar event
	const findOrCreateEvent = async (data: {
		type: 'holiday' | 'closure' | 'absence';
		title: string;
		startDate: Date;
		endDate: Date;
		affectsAllClasses: boolean;
	}) => {
		// Check if event with same title and start date exists
		const existing = await db
			.select()
			.from(calendarEvent)
			.where(and(eq(calendarEvent.title, data.title)))
			.limit(1);

		// Filter by start date in memory (drizzle doesn't support date equality well)
		const match = existing.find((e) => e.startDate.getTime() === data.startDate.getTime());

		if (match) {
			return match;
		}

		const [created] = await db.insert(calendarEvent).values(data).returning();
		return created;
	};

	// Autumn Half Term (usually last week of October)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Autumn Half Term',
		startDate: new Date(startYear, 9, 24), // Oct 24
		endDate: new Date(startYear, 9, 28), // Oct 28
		affectsAllClasses: true
	});

	// Christmas Holiday (usually mid-December to early January)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Christmas Holiday',
		startDate: new Date(startYear, 11, 20), // Dec 20
		endDate: new Date(endYear, 0, 3), // Jan 3
		affectsAllClasses: true
	});

	// Spring Half Term (usually mid-February)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Spring Half Term',
		startDate: new Date(endYear, 1, 14), // Feb 14
		endDate: new Date(endYear, 1, 18), // Feb 18
		affectsAllClasses: true
	});

	// Easter Holiday (typically early April, spans 2 weeks)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Easter Holiday',
		startDate: new Date(endYear, 3, 3), // Apr 3
		endDate: new Date(endYear, 3, 17), // Apr 17
		affectsAllClasses: true
	});

	// Summer Half Term (usually last week of May)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Summer Half Term',
		startDate: new Date(endYear, 4, 28), // May 28
		endDate: new Date(endYear, 5, 1), // Jun 1
		affectsAllClasses: true
	});

	// Summer Holiday (usually mid-July onwards)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Summer Holiday',
		startDate: new Date(endYear, 6, 21), // Jul 21
		endDate: new Date(endYear, 7, 31), // Aug 31
		affectsAllClasses: true
	});

	// UK Bank Holidays
	// Note: These are approximate dates and may vary year to year

	// Early May Bank Holiday (first Monday in May)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'May Day Bank Holiday',
		startDate: new Date(endYear, 4, 1), // May 1 (approximate)
		endDate: new Date(endYear, 4, 1),
		affectsAllClasses: true
	});

	// Spring Bank Holiday (last Monday in May)
	await findOrCreateEvent({
		type: 'holiday',
		title: 'Spring Bank Holiday',
		startDate: new Date(endYear, 4, 29), // May 29 (approximate)
		endDate: new Date(endYear, 4, 29),
		affectsAllClasses: true
	});
}
