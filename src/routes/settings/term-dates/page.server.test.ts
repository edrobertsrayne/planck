/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/server/db';
import { calendarEvent } from '$lib/server/db/schema';
import { actions, load } from './+page.server.js';

describe('Term Date Import - Page Server', () => {
	beforeEach(async () => {
		// Clear calendar events before each test
		await db.delete(calendarEvent);
	});

	describe('load function', () => {
		it('should return current academic year when no year parameter is provided', async () => {
			const result = await load({
				url: new URL('http://localhost/settings/term-dates')
			} as any);

			expect(result.academicYear).toBe('2025-26'); // Current year as of test date
			expect(result.currentAcademicYear).toBe('2025-26');
			expect(result.events).toEqual([]);
		});

		it('should load events for a specific academic year', async () => {
			// Seed some events for 2024-25
			await db.insert(calendarEvent).values([
				{
					type: 'holiday',
					title: 'Autumn Term Start',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				},
				{
					type: 'holiday',
					title: 'Christmas Holiday',
					startDate: new Date(2024, 11, 20),
					endDate: new Date(2025, 0, 3),
					affectsAllClasses: true
				}
			]);

			const result = await load({
				url: new URL('http://localhost/settings/term-dates?year=2024-25')
			} as any);

			expect(result.academicYear).toBe('2024-25');
			expect(result.events.length).toBeGreaterThan(0);
		});

		it('should only return events for the specified academic year', async () => {
			// Seed events for 2024-25
			await db.insert(calendarEvent).values([
				{
					type: 'holiday',
					title: '2024 Event',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				}
			]);

			// Seed event for different year (2026)
			await db.insert(calendarEvent).values([
				{
					type: 'holiday',
					title: '2026 Event',
					startDate: new Date(2026, 8, 1),
					endDate: new Date(2026, 8, 1),
					affectsAllClasses: true
				}
			]);

			const result = await load({
				url: new URL('http://localhost/settings/term-dates?year=2024-25')
			} as any);

			expect(result.events.length).toBe(1);
			expect(result.events[0].title).toBe('2024 Event');
		});
	});

	describe('import action', () => {
		it('should import UK term date template successfully', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');

			const result = await actions.import({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('success', true);
			expect(result).toHaveProperty('message');

			// Verify events were created
			const events = await db.select().from(calendarEvent);
			expect(events.length).toBeGreaterThan(0);
		});

		it('should reject empty academic year', async () => {
			const formData = new FormData();
			formData.append('academicYear', '');

			const result = await actions.import({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('error', 'Academic year is required');
		});

		it('should reject invalid academic year format', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024');

			const result = await actions.import({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('error');
			expect(result.error).toContain('format');
		});

		it('should accept valid academic year format', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2025-26');

			const result = await actions.import({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('success', true);
		});

		it('should be idempotent (safe to run multiple times)', async () => {
			const formData = new FormData();
			formData.append('academicYear', '2024-25');

			// First import
			await actions.import({
				request: { formData: async () => formData }
			} as any);
			const firstCount = (await db.select().from(calendarEvent)).length;

			// Second import
			await actions.import({
				request: { formData: async () => formData }
			} as any);
			const secondCount = (await db.select().from(calendarEvent)).length;

			// Should have same count (no duplicates)
			expect(secondCount).toBe(firstCount);
		});
	});

	describe('update action', () => {
		it('should update an existing event successfully', async () => {
			// Create an event
			const [event] = await db
				.insert(calendarEvent)
				.values({
					type: 'holiday',
					title: 'Original Title',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				})
				.returning();

			// Update the event
			const formData = new FormData();
			formData.append('eventId', event.id);
			formData.append('title', 'Updated Title');
			formData.append('startDate', '2024-09-05');
			formData.append('endDate', '2024-09-05');

			const result = await actions.update({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('success', true);

			// Verify the update
			const updated = await db.select().from(calendarEvent);
			expect(updated[0].title).toBe('Updated Title');
		});

		it('should reject update with missing fields', async () => {
			const formData = new FormData();
			formData.append('eventId', 'some-id');
			formData.append('title', 'Title');
			// Missing dates

			const result = await actions.update({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('error', 'All fields are required');
		});

		it('should reject update with end date before start date', async () => {
			const [event] = await db
				.insert(calendarEvent)
				.values({
					type: 'holiday',
					title: 'Test Event',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				})
				.returning();

			const formData = new FormData();
			formData.append('eventId', event.id);
			formData.append('title', 'Test Event');
			formData.append('startDate', '2024-09-10');
			formData.append('endDate', '2024-09-05'); // Before start date

			const result = await actions.update({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('error');
			expect(result.error).toContain('End date');
		});

		it('should allow same start and end date', async () => {
			const [event] = await db
				.insert(calendarEvent)
				.values({
					type: 'holiday',
					title: 'Test Event',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				})
				.returning();

			const formData = new FormData();
			formData.append('eventId', event.id);
			formData.append('title', 'Test Event');
			formData.append('startDate', '2024-09-10');
			formData.append('endDate', '2024-09-10');

			const result = await actions.update({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('success', true);
		});
	});

	describe('delete action', () => {
		it('should delete an event successfully', async () => {
			// Create an event
			const [event] = await db
				.insert(calendarEvent)
				.values({
					type: 'holiday',
					title: 'Test Event',
					startDate: new Date(2024, 8, 1),
					endDate: new Date(2024, 8, 1),
					affectsAllClasses: true
				})
				.returning();

			// Delete the event
			const formData = new FormData();
			formData.append('eventId', event.id);

			const result = await actions.delete({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('success', true);

			// Verify deletion
			const events = await db.select().from(calendarEvent);
			expect(events.length).toBe(0);
		});

		it('should reject delete with missing event ID', async () => {
			const formData = new FormData();

			const result = await actions.delete({
				request: { formData: async () => formData }
			} as any);

			expect(result).toHaveProperty('error', 'Event ID is required');
		});
	});
});
