import { describe, it, expect, beforeEach } from 'vitest';
import { seedTermDates } from './seed';
import { db } from './index';
import { calendarEvent } from './schema';
import { eq } from 'drizzle-orm';

describe('seedTermDates', () => {
	beforeEach(async () => {
		// Clear existing calendar events before each test
		await db.delete(calendarEvent);
	});

	it('should create autumn term start and end events', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent).where(eq(calendarEvent.type, 'holiday'));

		// Should include autumn term period
		const autumnEvents = events.filter((e) => e.title.toLowerCase().includes('autumn'));
		expect(autumnEvents.length).toBeGreaterThan(0);
	});

	it('should create all three terms (autumn, spring, summer)', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent).where(eq(calendarEvent.type, 'holiday'));

		const titles = events.map((e) => e.title.toLowerCase());

		// Should have references to all three terms
		const hasAutumn = titles.some((t) => t.includes('autumn'));
		const hasSpring = titles.some((t) => t.includes('spring'));
		const hasSummer = titles.some((t) => t.includes('summer'));

		expect(hasAutumn).toBe(true);
		expect(hasSpring).toBe(true);
		expect(hasSummer).toBe(true);
	});

	it('should create half-term breaks', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent).where(eq(calendarEvent.type, 'holiday'));

		const halfTermEvents = events.filter((e) => e.title.toLowerCase().includes('half term'));

		// Should have at least 3 half-term breaks (one per term)
		expect(halfTermEvents.length).toBeGreaterThanOrEqual(3);
	});

	it('should create bank holiday events', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent).where(eq(calendarEvent.type, 'holiday'));

		// Should include common UK bank holidays
		const titles = events.map((e) => e.title.toLowerCase());

		// Check for at least some bank holidays
		const hasBankHoliday = titles.some(
			(t) =>
				t.includes('bank holiday') ||
				t.includes('easter') ||
				t.includes('may day') ||
				t.includes('christmas') ||
				t.includes('new year')
		);

		expect(hasBankHoliday).toBe(true);
	});

	it('should set all events to affect all classes', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		// All seeded term dates should affect all classes
		for (const event of events) {
			expect(event.affectsAllClasses).toBe(true);
		}
	});

	it('should set event type to "holiday" for all term date events', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		// All seeded term dates should be of type "holiday"
		for (const event of events) {
			expect(event.type).toBe('holiday');
		}
	});

	it('should use correct year range for academic year', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		// Events should span from Sept 2024 to July 2025
		for (const event of events) {
			const year = event.startDate.getFullYear();
			expect([2024, 2025]).toContain(year);
		}
	});

	it('should have valid date ranges (endDate >= startDate)', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		for (const event of events) {
			expect(event.endDate >= event.startDate).toBe(true);
		}
	});

	it('should be idempotent (not create duplicates on multiple runs)', async () => {
		const academicYear = '2024-25';

		await seedTermDates(academicYear);
		const firstRun = await db.select().from(calendarEvent);

		await seedTermDates(academicYear);
		const secondRun = await db.select().from(calendarEvent);

		// Should have the same number of events after running twice
		expect(secondRun).toHaveLength(firstRun.length);
	});

	it('should support different academic years', async () => {
		await seedTermDates('2024-25');
		const events2024 = await db.select().from(calendarEvent);

		await db.delete(calendarEvent);

		await seedTermDates('2025-26');
		const events2025 = await db.select().from(calendarEvent);

		// Should create events for the specified year
		expect(events2024.length).toBeGreaterThan(0);
		expect(events2025.length).toBeGreaterThan(0);

		// 2024-25 events should be in 2024-2025
		const has2024 = events2024.some((e) => e.startDate.getFullYear() === 2024);
		expect(has2024).toBe(true);

		// 2025-26 events should be in 2025-2026
		const has2025 = events2025.some((e) => e.startDate.getFullYear() === 2025);
		expect(has2025).toBe(true);
	});

	it('should create autumn term spanning September to December', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		// Find autumn term start event
		const autumnStart = events.find(
			(e) => e.title.toLowerCase().includes('autumn') && e.title.toLowerCase().includes('start')
		);

		if (autumnStart) {
			const month = autumnStart.startDate.getMonth();
			expect(month).toBe(8); // September (0-indexed)
		}
	});

	it('should create spring term in January', async () => {
		const academicYear = '2024-25';
		await seedTermDates(academicYear);

		const events = await db.select().from(calendarEvent);

		// Find spring term start event
		const springStart = events.find(
			(e) => e.title.toLowerCase().includes('spring') && e.title.toLowerCase().includes('start')
		);

		if (springStart) {
			const month = springStart.startDate.getMonth();
			expect(month).toBe(0); // January (0-indexed)
		}
	});
});
