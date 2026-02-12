import { db } from '$lib/server/db';
import { calendarEvent } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get all calendar events ordered by start date
	const events = await db.select().from(calendarEvent).orderBy(asc(calendarEvent.startDate));

	return {
		events
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const type = data.get('type')?.toString() as 'holiday' | 'closure' | 'absence' | undefined;
		const title = data.get('title')?.toString() || '';
		const startDateStr = data.get('startDate')?.toString() || '';
		const endDateStr = data.get('endDate')?.toString() || '';
		const affectsAllClassesStr = data.get('affectsAllClasses')?.toString();

		// Validation
		if (!type || !['holiday', 'closure', 'absence'].includes(type)) {
			return { error: 'Event type is required and must be holiday, closure, or absence' };
		}

		if (!title.trim()) {
			return { error: 'Event title is required' };
		}

		if (!startDateStr.trim()) {
			return { error: 'Start date is required' };
		}

		if (!endDateStr.trim()) {
			return { error: 'End date is required' };
		}

		const startDate = new Date(startDateStr);
		const endDate = new Date(endDateStr);

		// Validate dates
		if (isNaN(startDate.getTime())) {
			return { error: 'Invalid start date' };
		}

		if (isNaN(endDate.getTime())) {
			return { error: 'Invalid end date' };
		}

		if (endDate < startDate) {
			return { error: 'End date must be on or after start date' };
		}

		// Set times to midnight UTC for consistency
		startDate.setUTCHours(0, 0, 0, 0);
		endDate.setUTCHours(0, 0, 0, 0);

		const affectsAllClasses = affectsAllClassesStr === 'true' || affectsAllClassesStr === '1';

		// Insert new calendar event
		await db.insert(calendarEvent).values({
			type,
			title: title.trim(),
			startDate,
			endDate,
			affectsAllClasses
		});

		return { success: true };
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id')?.toString();

		if (!id) {
			return { error: 'Event ID is required' };
		}

		// Delete the event
		await db.delete(calendarEvent).where(eq(calendarEvent.id, id));

		return { success: true, deleted: true };
	}
};
