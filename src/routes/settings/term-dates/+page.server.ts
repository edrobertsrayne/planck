import { db } from '$lib/server/db';
import { calendarEvent } from '$lib/server/db/schema';
import { seedTermDates } from '$lib/server/db/seed';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const academicYear = url.searchParams.get('year') || '';

	// If academic year is provided, fetch existing events for that year
	if (academicYear) {
		// Parse the academic year to determine date range
		const [startYearStr] = academicYear.split('-');
		const startYear = parseInt(startYearStr, 10);

		// Get all events for the academic year (Sept startYear to Aug endYear)
		const events = await db
			.select()
			.from(calendarEvent)
			.where(eq(calendarEvent.affectsAllClasses, true));

		// Filter events that fall within the academic year
		const yearEvents = events.filter((event) => {
			const eventYear = event.startDate.getFullYear();
			return eventYear === startYear || eventYear === startYear + 1;
		});

		return {
			academicYear,
			events: yearEvents
		};
	}

	return {
		academicYear: '',
		events: []
	};
};

export const actions: Actions = {
	// Import UK term date template for a given academic year
	import: async ({ request }) => {
		const data = await request.formData();
		const academicYear = data.get('academicYear')?.toString() || '';

		// Validation
		if (!academicYear.trim()) {
			return { error: 'Academic year is required' };
		}

		// Validate format (YYYY-YY)
		const yearPattern = /^\d{4}-\d{2}$/;
		if (!yearPattern.test(academicYear)) {
			return { error: 'Academic year must be in format YYYY-YY (e.g., 2024-25)' };
		}

		try {
			// Import template dates
			await seedTermDates(academicYear);

			return {
				success: true,
				message: `UK term date template imported for ${academicYear}`
			};
		} catch (error) {
			console.error('Error importing term dates:', error);
			return { error: 'Failed to import term dates. Please try again.' };
		}
	},

	// Update an individual calendar event
	update: async ({ request }) => {
		const data = await request.formData();
		const eventId = data.get('eventId')?.toString() || '';
		const title = data.get('title')?.toString() || '';
		const startDateStr = data.get('startDate')?.toString() || '';
		const endDateStr = data.get('endDate')?.toString() || '';

		// Validation
		if (!eventId || !title || !startDateStr || !endDateStr) {
			return { error: 'All fields are required' };
		}

		try {
			const startDate = new Date(startDateStr);
			const endDate = new Date(endDateStr);

			if (endDate < startDate) {
				return { error: 'End date must be on or after start date' };
			}

			// Update the event
			await db
				.update(calendarEvent)
				.set({
					title,
					startDate,
					endDate,
					updatedAt: new Date()
				})
				.where(eq(calendarEvent.id, eventId));

			return { success: true, message: 'Event updated successfully' };
		} catch (error) {
			console.error('Error updating event:', error);
			return { error: 'Failed to update event. Please try again.' };
		}
	},

	// Delete a calendar event
	delete: async ({ request }) => {
		const data = await request.formData();
		const eventId = data.get('eventId')?.toString() || '';

		if (!eventId) {
			return { error: 'Event ID is required' };
		}

		try {
			await db.delete(calendarEvent).where(eq(calendarEvent.id, eventId));

			return { success: true, message: 'Event deleted successfully' };
		} catch (error) {
			console.error('Error deleting event:', error);
			return { error: 'Failed to delete event. Please try again.' };
		}
	}
};
