import { db } from '$lib/server/db';
import { timetableConfig } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get the most recent timetable config (ordered by academic year descending)
	const configs = await db
		.select()
		.from(timetableConfig)
		.orderBy(desc(timetableConfig.academicYear))
		.limit(1);

	return {
		config: configs[0] || null
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

		// Check if config exists for this academic year
		const existing = await db
			.select()
			.from(timetableConfig)
			.where(eq(timetableConfig.academicYear, academicYear))
			.limit(1);

		if (existing.length > 0) {
			// Update existing config
			await db
				.update(timetableConfig)
				.set({
					weeks,
					periodsPerDay,
					daysPerWeek,
					updatedAt: new Date()
				})
				.where(eq(timetableConfig.academicYear, academicYear));
		} else {
			// Insert new config
			await db.insert(timetableConfig).values({
				academicYear,
				weeks,
				periodsPerDay,
				daysPerWeek
			});
		}

		return { success: true };
	}
};
