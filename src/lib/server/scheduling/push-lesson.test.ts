import { describe, it, expect, beforeEach } from 'vitest';
import { pushLesson } from './push-lesson';
import { assignModuleToClass } from './assign-module';
import { db } from '$lib/server/db';
import {
	teachingClass,
	course,
	module,
	lesson,
	timetableSlot,
	timetableConfig,
	moduleAssignment,
	scheduledLesson,
	calendarEvent
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('pushLesson', () => {
	let testCourse: { id: string };
	let testClass: { id: string };
	let testModule: { id: string };

	beforeEach(async () => {
		// Clean up test data
		await db.delete(calendarEvent);
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(timetableSlot);
		await db.delete(timetableConfig);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(teachingClass);
		await db.delete(course);

		// Create test course
		const courses = await db.insert(course).values({ name: 'GCSE Physics' }).returning();
		testCourse = courses[0];

		// Create test class
		const classes = await db
			.insert(teachingClass)
			.values({
				name: '11X/Ph1',
				yearGroup: 11,
				courseId: testCourse.id,
				academicYear: '2024-25'
			})
			.returning();
		testClass = classes[0];

		// Create timetable config
		await db.insert(timetableConfig).values({
			academicYear: '2024-25',
			weeks: 1,
			periodsPerDay: 6,
			daysPerWeek: 5
		});

		// Create timetable slots (Mon-Fri, Period 1, single periods)
		for (let day = 1; day <= 5; day++) {
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day,
				periodStart: 1,
				periodEnd: 1,
				week: null
			});
		}

		// Create test module
		const modules = await db
			.insert(module)
			.values({
				name: 'Forces Module',
				courseId: testCourse.id
			})
			.returning();
		testModule = modules[0];

		// Create test lessons
		for (let i = 1; i <= 5; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i}`,
				content: `Content for lesson ${i}`,
				duration: 1,
				order: i
			});
		}
	});

	it('should push a lesson forward by one slot', async () => {
		// Assign module starting from Monday of week 1
		const monday = new Date('2024-09-02T00:00:00.000Z'); // A Monday
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(lessons).toHaveLength(5);

		// Push the first lesson forward
		const firstLesson = lessons[0];
		const result = await pushLesson({
			lessonId: firstLesson.id,
			direction: 'forward'
		});

		// Should have moved the lesson and cascaded all subsequent lessons
		expect(result.lessonsAffected).toBe(5);
		expect(result.changes).toHaveLength(5);

		// Verify the first lesson is now on Tuesday
		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(updatedLessons[0].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z'); // Tuesday
		expect(updatedLessons[1].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z'); // Wednesday
		expect(updatedLessons[2].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z'); // Thursday
		expect(updatedLessons[3].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z'); // Friday
		expect(updatedLessons[4].calendarDate.toISOString()).toBe('2024-09-09T00:00:00.000Z'); // Next Monday
	});

	it('should push a lesson backward by one slot', async () => {
		// Assign module starting from Wednesday
		const wednesday = new Date('2024-09-04T00:00:00.000Z'); // A Wednesday
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: wednesday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(lessons).toHaveLength(5);

		// Push the first lesson backward
		const firstLesson = lessons[0];
		const result = await pushLesson({
			lessonId: firstLesson.id,
			direction: 'back'
		});

		// Should have moved the lesson backward
		expect(result.lessonsAffected).toBe(1);
		expect(result.changes).toHaveLength(1);

		// Verify the first lesson is now on Tuesday
		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(updatedLessons[0].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z'); // Tuesday
		expect(updatedLessons[1].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z'); // Thursday (unchanged)
		expect(updatedLessons[2].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z'); // Friday (unchanged)
	});

	it('should push a middle lesson forward and cascade subsequent lessons', async () => {
		// Assign module starting from Monday
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// Push the third lesson (Wednesday) forward
		const thirdLesson = lessons[2];
		const result = await pushLesson({
			lessonId: thirdLesson.id,
			direction: 'forward'
		});

		// Should have moved lesson 3, 4, and 5
		expect(result.lessonsAffected).toBe(3);
		expect(result.changes).toHaveLength(3);

		// Verify lessons
		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// First two lessons should be unchanged
		expect(updatedLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z'); // Monday
		expect(updatedLessons[1].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z'); // Tuesday

		// Third lesson pushed to Thursday
		expect(updatedLessons[2].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z'); // Thursday

		// Fourth and fifth cascade forward
		expect(updatedLessons[3].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z'); // Friday
		expect(updatedLessons[4].calendarDate.toISOString()).toBe('2024-09-09T00:00:00.000Z'); // Next Monday
	});

	it('should skip calendar events when pushing forward', async () => {
		// Create a calendar event for Wednesday-Thursday
		await db.insert(calendarEvent).values({
			type: 'holiday',
			title: 'Mid-week break',
			startDate: new Date('2024-09-04T00:00:00.000Z'), // Wednesday
			endDate: new Date('2024-09-05T00:00:00.000Z'), // Thursday
			affectsAllClasses: true
		});

		// Assign module starting from Monday
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// Push the second lesson forward (should skip the event days)
		const secondLesson = lessons[1];
		await pushLesson({
			lessonId: secondLesson.id,
			direction: 'forward'
		});

		// Verify the second lesson moved to Friday (skipping Wed/Thu event)
		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// First lesson unchanged
		expect(updatedLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z'); // Monday

		// Second lesson pushed to Friday (skipping Wed/Thu)
		expect(updatedLessons[1].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z'); // Friday

		// Subsequent lessons cascade
		expect(updatedLessons[2].calendarDate.toISOString()).toBe('2024-09-09T00:00:00.000Z'); // Next Monday
	});

	it('should preview changes without applying them', async () => {
		// Assign module starting from Monday
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		const firstLesson = lessons[0];

		// Preview push forward
		const result = await pushLesson({
			lessonId: firstLesson.id,
			direction: 'forward',
			preview: true
		});

		// Should show what would change
		expect(result.lessonsAffected).toBe(5);
		expect(result.changes).toHaveLength(5);

		// But lessons should not actually be updated
		const unchangedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(unchangedLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z'); // Still Monday
		expect(unchangedLessons[1].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z'); // Still Tuesday
	});

	it('should handle double period lessons when pushing', async () => {
		// Create a timetable slot for double periods
		await db.delete(timetableSlot).where(eq(timetableSlot.classId, testClass.id));

		for (let day = 1; day <= 5; day++) {
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day,
				periodStart: 1,
				periodEnd: 2, // Double period
				week: null
			});
		}

		// Delete old lessons and create new ones with double duration
		await db.delete(lesson).where(eq(lesson.moduleId, testModule.id));

		for (let i = 1; i <= 3; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Double Lesson ${i}`,
				content: `Content for double lesson ${i}`,
				duration: 2, // Double period
				order: i
			});
		}

		// Assign module
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(lessons).toHaveLength(3);

		// Push the first lesson forward
		const result = await pushLesson({
			lessonId: lessons[0].id,
			direction: 'forward'
		});

		// Should cascade all 3 double lessons
		expect(result.lessonsAffected).toBe(3);

		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		expect(updatedLessons[0].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z'); // Tuesday
		expect(updatedLessons[1].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z'); // Wednesday
		expect(updatedLessons[2].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z'); // Thursday
	});

	it('should handle 2-week timetables with Week A/B when pushing', async () => {
		// Update timetable config to 2-week
		await db
			.update(timetableConfig)
			.set({ weeks: 2 })
			.where(eq(timetableConfig.academicYear, '2024-25'));

		// Delete old slots and create Week A and Week B slots
		await db.delete(timetableSlot).where(eq(timetableSlot.classId, testClass.id));

		// Week A: Monday and Wednesday
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 1, // Monday
			periodStart: 1,
			periodEnd: 1,
			week: 'A'
		});
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 3, // Wednesday
			periodStart: 1,
			periodEnd: 1,
			week: 'A'
		});

		// Week B: Tuesday and Thursday
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 2, // Tuesday
			periodStart: 1,
			periodEnd: 1,
			week: 'B'
		});
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 4, // Thursday
			periodStart: 1,
			periodEnd: 1,
			week: 'B'
		});

		// Assign module
		const monday = new Date('2024-09-02T00:00:00.000Z'); // Week A Monday
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Get the scheduled lessons
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// Check how many lessons were actually scheduled
		// With a 2-week cycle and 4 slots (Week A: Mon/Wed, Week B: Tue/Thu),
		// we should be able to schedule all 5 lessons over the 2-week period
		expect(lessons.length).toBe(5);

		// Push the first lesson forward
		const result = await pushLesson({
			lessonId: lessons[0].id,
			direction: 'forward'
		});

		// At least some lessons should be affected
		expect(result.lessonsAffected).toBeGreaterThan(0);
		expect(result.changes.length).toBeGreaterThan(0);

		// Verify the Week A/B pattern is maintained
		const updatedLessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// All lessons should still be scheduled
		expect(updatedLessons.length).toBe(5);

		// First lesson should have moved forward to next available slot
		expect(updatedLessons[0].calendarDate.getTime()).toBeGreaterThan(
			lessons[0].calendarDate.getTime()
		);
	});

	it('should throw error when no suitable slot is available', async () => {
		// Create only one timetable slot
		await db.delete(timetableSlot).where(eq(timetableSlot.classId, testClass.id));

		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 1, // Monday only
			periodStart: 1,
			periodEnd: 1,
			week: null
		});

		// Assign module
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const assignmentId = await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate: monday
		});

		// Block all future Mondays with events for a long time
		for (let week = 0; week < 100; week++) {
			const eventDate = new Date('2024-09-09T00:00:00.000Z');
			eventDate.setUTCDate(eventDate.getUTCDate() + week * 7);

			await db.insert(calendarEvent).values({
				type: 'holiday',
				title: `Event ${week}`,
				startDate: eventDate,
				endDate: eventDate,
				affectsAllClasses: true
			});
		}

		// Get the first lesson
		const lessons = await db
			.select()
			.from(scheduledLesson)
			.where(eq(scheduledLesson.assignmentId, assignmentId))
			.orderBy(scheduledLesson.calendarDate);

		// Try to push forward - should fail due to no available slots
		await expect(
			pushLesson({
				lessonId: lessons[0].id,
				direction: 'forward'
			})
		).rejects.toThrow(/Could not find a suitable slot/);
	});

	it('should throw error for non-existent lesson', async () => {
		await expect(
			pushLesson({
				lessonId: 'non-existent-id',
				direction: 'forward'
			})
		).rejects.toThrow('Scheduled lesson not found');
	});
});
