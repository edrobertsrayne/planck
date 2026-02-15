import { db } from '$lib/server/db';
import { timetableConfig } from '$lib/server/db/schema';
import { eq, desc, ne } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get GLOBAL config for school-wide settings (weeks)
	const globalConfigs = await db
		.select()
		.from(timetableConfig)
		.where(eq(timetableConfig.academicYear, 'GLOBAL'))
		.limit(1);

	// Get the most recent year-specific timetable config
	const yearConfigs = await db
		.select()
		.from(timetableConfig)
		.where(ne(timetableConfig.academicYear, 'GLOBAL'))
		.orderBy(desc(timetableConfig.academicYear))
		.limit(1);

	return {
		globalConfig: globalConfigs[0] || null,
		config: yearConfigs[0] || null
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const data = await request.formData();
		const academicYear = data.get('academicYear')?.toString() || '';
		const weeks = parseInt(data.get('weeks')?.toString() || '1');
		const periodsPerDay = parseInt(data.get('periodsPerDay')?.toString() || '6');
		const daysPerWeek = parseInt(data.get('daysPerWeek')?.toString() || '5');

		// Validation
		if (!academicYear.trim()) {
			return { error: 'Academic year is required' };
		}

		if (weeks !== 1 && weeks !== 2) {
			return { error: 'Weeks must be 1 or 2' };
		}

		if (periodsPerDay < 1 || periodsPerDay > 10) {
			return { error: 'Periods per day must be between 1 and 10' };
		}

		if (daysPerWeek < 1 || daysPerWeek > 7) {
			return { error: 'Days per week must be between 1 and 7' };
		}

		// Save weeks to GLOBAL config
		const existingGlobal = await db
			.select()
			.from(timetableConfig)
			.where(eq(timetableConfig.academicYear, 'GLOBAL'))
			.limit(1);

		if (existingGlobal.length > 0) {
			// Update existing GLOBAL config
			await db
				.update(timetableConfig)
				.set({
					weeks,
					updatedAt: new Date()
				})
				.where(eq(timetableConfig.academicYear, 'GLOBAL'));
		} else {
			// Insert new GLOBAL config
			await db.insert(timetableConfig).values({
				academicYear: 'GLOBAL',
				weeks,
				periodsPerDay: 6, // Default values for GLOBAL (not used)
				daysPerWeek: 5
			});
		}

		// Save periodsPerDay and daysPerWeek to year-specific config
		const existingYear = await db
			.select()
			.from(timetableConfig)
			.where(eq(timetableConfig.academicYear, academicYear))
			.limit(1);

		if (existingYear.length > 0) {
			// Update existing year config
			await db
				.update(timetableConfig)
				.set({
					periodsPerDay,
					daysPerWeek,
					updatedAt: new Date()
				})
				.where(eq(timetableConfig.academicYear, academicYear));
		} else {
			// Insert new year config
			await db.insert(timetableConfig).values({
				academicYear,
				weeks: 1, // Default value (not used, GLOBAL config is used instead)
				periodsPerDay,
				daysPerWeek
			});
		}

		return { success: true };
	}
};
