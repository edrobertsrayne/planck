/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import { calendarEvent } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';

describe('Calendar Events Page Server', () => {
	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(calendarEvent);
	});

	describe('load function', () => {
		it('should return empty array when no events exist', async () => {
			const result = await load({} as RequestEvent);

			expect(result.events).toEqual([]);
		});

		it('should return all events ordered by start date', async () => {
			// Insert test events
			const earlyDate = new Date('2024-12-01');
			const lateDate = new Date('2025-01-15');

			await db.insert(calendarEvent).values({
				type: 'closure',
				title: 'INSET Day',
				startDate: lateDate,
				endDate: lateDate,
				affectsAllClasses: true
			});

			await db.insert(calendarEvent).values({
				type: 'holiday',
				title: 'Winter Break',
				startDate: earlyDate,
				endDate: new Date('2024-12-20'),
				affectsAllClasses: true
			});

			const result = await load({} as RequestEvent);

			expect(result.events).toHaveLength(2);
			// Should be ordered by start date (earliest first)
			expect(result.events[0].title).toBe('Winter Break');
			expect(result.events[1].title).toBe('INSET Day');
		});

		it('should return events with all properties', async () => {
			await db.insert(calendarEvent).values({
				type: 'absence',
				title: 'Personal Absence',
				startDate: new Date('2025-02-10'),
				endDate: new Date('2025-02-11'),
				affectsAllClasses: false
			});

			const result = await load({} as RequestEvent);

			expect(result.events).toHaveLength(1);
			expect(result.events[0].type).toBe('absence');
			expect(result.events[0].title).toBe('Personal Absence');
			expect(result.events[0].affectsAllClasses).toBe(false);
		});
	});

	describe('create action', () => {
		it('should create a holiday event', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Half Term');
			formData.append('startDate', '2025-02-17');
			formData.append('endDate', '2025-02-21');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('holiday');
			expect(events[0].title).toBe('Half Term');
			expect(events[0].affectsAllClasses).toBe(true);
		});

		it('should create a closure event', async () => {
			const formData = new FormData();
			formData.append('type', 'closure');
			formData.append('title', 'INSET Day');
			formData.append('startDate', '2025-03-05');
			formData.append('endDate', '2025-03-05');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('closure');
			expect(events[0].title).toBe('INSET Day');
		});

		it('should create an absence event', async () => {
			const formData = new FormData();
			formData.append('type', 'absence');
			formData.append('title', 'Conference Absence');
			formData.append('startDate', '2025-04-10');
			formData.append('endDate', '2025-04-11');
			formData.append('affectsAllClasses', 'false');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe('absence');
			expect(events[0].affectsAllClasses).toBe(false);
		});

		it('should create multi-day event', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Christmas Break');
			formData.append('startDate', '2024-12-20');
			formData.append('endDate', '2025-01-06');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(1);
			expect(new Date(events[0].startDate).toISOString().split('T')[0]).toBe('2024-12-20');
			expect(new Date(events[0].endDate).toISOString().split('T')[0]).toBe('2025-01-06');
		});

		it('should reject invalid event type', async () => {
			const formData = new FormData();
			formData.append('type', 'invalid');
			formData.append('title', 'Test Event');
			formData.append('startDate', '2025-03-01');
			formData.append('endDate', '2025-03-01');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Event type is required and must be holiday, closure, or absence');

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(0);
		});

		it('should reject empty title', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', '   ');
			formData.append('startDate', '2025-03-01');
			formData.append('endDate', '2025-03-01');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Event title is required');

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(0);
		});

		it('should reject missing start date', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Test Event');
			formData.append('startDate', '');
			formData.append('endDate', '2025-03-01');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Start date is required');
		});

		it('should reject missing end date', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Test Event');
			formData.append('startDate', '2025-03-01');
			formData.append('endDate', '');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('End date is required');
		});

		it('should reject invalid start date', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Test Event');
			formData.append('startDate', 'not-a-date');
			formData.append('endDate', '2025-03-01');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Invalid start date');
		});

		it('should reject invalid end date', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Test Event');
			formData.append('startDate', '2025-03-01');
			formData.append('endDate', 'not-a-date');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Invalid end date');
		});

		it('should reject end date before start date', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', 'Test Event');
			formData.append('startDate', '2025-03-10');
			formData.append('endDate', '2025-03-05');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('End date must be on or after start date');
		});

		it('should default affectsAllClasses to false when not provided', async () => {
			const formData = new FormData();
			formData.append('type', 'absence');
			formData.append('title', 'Personal Day');
			formData.append('startDate', '2025-03-15');
			formData.append('endDate', '2025-03-15');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events).toHaveLength(1);
			expect(events[0].affectsAllClasses).toBe(false);
		});

		it('should trim whitespace from title', async () => {
			const formData = new FormData();
			formData.append('type', 'holiday');
			formData.append('title', '  Easter Break  ');
			formData.append('startDate', '2025-04-07');
			formData.append('endDate', '2025-04-21');
			formData.append('affectsAllClasses', 'true');

			const result = await actions.create({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);

			const events = await db.select().from(calendarEvent);
			expect(events[0].title).toBe('Easter Break');
		});
	});

	describe('delete action', () => {
		it('should delete an existing event', async () => {
			const events = await db
				.insert(calendarEvent)
				.values({
					type: 'holiday',
					title: 'Test Event',
					startDate: new Date('2025-03-01'),
					endDate: new Date('2025-03-05'),
					affectsAllClasses: true
				})
				.returning();

			const eventId = events[0].id;

			const formData = new FormData();
			formData.append('id', eventId);

			const result = await actions.delete({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.success).toBe(true);
			expect(result.deleted).toBe(true);

			const remainingEvents = await db.select().from(calendarEvent);
			expect(remainingEvents).toHaveLength(0);
		});

		it('should reject deletion without event ID', async () => {
			const formData = new FormData();

			const result = await actions.delete({
				request: { formData: async () => formData }
			} as RequestEvent);

			expect(result.error).toBe('Event ID is required');
		});

		it('should handle deletion of non-existent event gracefully', async () => {
			const formData = new FormData();
			formData.append('id', 'non-existent-id');

			const result = await actions.delete({
				request: { formData: async () => formData }
			} as RequestEvent);

			// Should still return success (idempotent delete)
			expect(result.success).toBe(true);
		});
	});
});
