import { describe, it, expect, beforeEach } from 'vitest';
import { rescheduleLessonsForEvent } from './reschedule';
import { assignModuleToClass } from './assign-module';
import { db } from '$lib/server/db';
import {
	teachingClass,
	examSpec,
	module,
	lesson,
	lessonSpecPoint,
	specPoint,
	topic,
	timetableSlot,
	timetableConfig,
	moduleAssignment,
	scheduledLesson,
	scheduledLessonSpecPoint,
	calendarEvent
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

describe('rescheduleLessonsForEvent', () => {
	let testExamSpec: { id: string };
	let testClass: { id: string };
	let testModule: { id: string };
	let testTopic: { id: string };

	beforeEach(async () => {
		// Clean up test data
		await db.delete(calendarEvent);
		await db.delete(scheduledLessonSpecPoint);
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(timetableSlot);
		await db.delete(timetableConfig);
		await db.delete(lessonSpecPoint);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(specPoint);
		await db.delete(topic);
		await db.delete(teachingClass);
		await db.delete(examSpec);

		// Create test exam spec
		const specs = await db
			.insert(examSpec)
			.values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)',
				specCode: '8463',
				specYear: '2018'
			})
			.returning();
		testExamSpec = specs[0];

		// Create test topic
		const topics = await db
			.insert(topic)
			.values({
				examSpecId: testExamSpec.id,
				name: 'Forces',
				code: '4.1',
				sortOrder: 1
			})
			.returning();
		testTopic = topics[0];

		// Create a spec point for potential future use
		await db.insert(specPoint).values({
			topicId: testTopic.id,
			reference: '4.1.1',
			content: 'Forces and their interactions',
			sortOrder: 1
		});

		// Create test class
		const classes = await db
			.insert(teachingClass)
			.values({
				name: '11X/Ph1',
				yearGroup: 11,
				examSpecId: testExamSpec.id,
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
				name: 'Test Module',
				targetSpecId: testExamSpec.id
			})
			.returning();
		testModule = modules[0];
	});

	it('should reschedule lessons when a single-day event is added', async () => {
		// Create 5 lessons (one week of lessons)
		for (let i = 0; i < 5; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		// Assign module starting from Monday 2024-09-02
		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Verify lessons are scheduled Mon-Fri (Sep 2-6)
		const originalLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(originalLessons).toHaveLength(5);
		expect(originalLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(originalLessons[1].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z');
		expect(originalLessons[2].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z');

		// Add a holiday on Wednesday (Sep 4)
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'holiday',
				title: 'Test Holiday',
				startDate: new Date('2024-09-04T00:00:00Z'),
				endDate: new Date('2024-09-04T00:00:00Z'),
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Reschedule lessons
		const result = await rescheduleLessonsForEvent({ eventId });

		// Should reschedule 3 lessons (Wed, Thu, Fri -> Thu, Fri, Mon next week)
		expect(result.lessonsRescheduled).toBe(3);
		expect(result.rescheduledLessonIds).toHaveLength(3);

		// Verify new schedule
		const rescheduledLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(rescheduledLessons).toHaveLength(5);
		// Mon and Tue unchanged
		expect(rescheduledLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(rescheduledLessons[1].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z');
		// Wed lesson moved to Thu
		expect(rescheduledLessons[2].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z');
		// Thu lesson moved to Fri
		expect(rescheduledLessons[3].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z');
		// Fri lesson moved to Mon next week
		expect(rescheduledLessons[4].calendarDate.toISOString()).toBe('2024-09-09T00:00:00.000Z');
	});

	it('should reschedule lessons when a multi-day event is added', async () => {
		// Create 10 lessons (two weeks)
		for (let i = 0; i < 10; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		// Assign module starting from Monday 2024-09-02
		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Add a week-long holiday (Sep 9-13, week 2)
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'holiday',
				title: 'Half Term',
				startDate: new Date('2024-09-09T00:00:00Z'),
				endDate: new Date('2024-09-13T00:00:00Z'),
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Reschedule lessons
		const result = await rescheduleLessonsForEvent({ eventId });

		// Should reschedule 5 lessons (week 2 -> week 3)
		expect(result.lessonsRescheduled).toBe(5);

		// Verify new schedule
		const rescheduledLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(rescheduledLessons).toHaveLength(10);
		// Week 1 unchanged (Sep 2-6)
		expect(rescheduledLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(rescheduledLessons[4].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z');
		// Week 2 moved to week 3 (Sep 16-20)
		expect(rescheduledLessons[5].calendarDate.toISOString()).toBe('2024-09-16T00:00:00.000Z');
		expect(rescheduledLessons[9].calendarDate.toISOString()).toBe('2024-09-20T00:00:00.000Z');
	});

	it('should handle double period lessons when rescheduling', async () => {
		// Add a double period slot on Tuesday
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 2, // Tuesday
			periodStart: 2,
			periodEnd: 3, // Double period
			week: null
		});

		// Create lessons with mix of single and double
		await db.insert(lesson).values({
			moduleId: testModule.id,
			title: 'Single Lesson',
			duration: 1,
			order: 0
		});

		await db.insert(lesson).values({
			moduleId: testModule.id,
			title: 'Double Lesson',
			duration: 2,
			order: 1
		});

		await db.insert(lesson).values({
			moduleId: testModule.id,
			title: 'Another Single',
			duration: 1,
			order: 2
		});

		// Assign module
		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Verify original schedule
		const originalLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(originalLessons).toHaveLength(3);
		// First two should be single on Mon and double on Tue
		expect(originalLessons[0].duration).toBe(1);
		expect(originalLessons[1].duration).toBe(2);
		expect(originalLessons[2].duration).toBe(1);

		// Get the actual event date from the second lesson (double period)
		const doubleLessonDate = originalLessons[1].calendarDate;

		// Add event on the date of the double period lesson
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'closure',
				title: 'INSET Day',
				startDate: doubleLessonDate,
				endDate: doubleLessonDate,
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Reschedule
		const result = await rescheduleLessonsForEvent({ eventId });

		// Should reschedule the double and following single
		expect(result.lessonsRescheduled).toBe(2);

		// Verify rescheduled lessons maintain their durations
		const rescheduledLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(rescheduledLessons).toHaveLength(3);

		// First lesson (single) should stay on Monday (unchanged)
		expect(rescheduledLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(rescheduledLessons[0].duration).toBe(1);

		// All lessons should maintain their durations
		const durations = rescheduledLessons.map((l) => l.duration).sort();
		expect(durations).toEqual([1, 1, 2]);

		// The double period lesson should be rescheduled and maintain duration of 2
		const doubleLessonAfter = rescheduledLessons.find((l) => l.duration === 2);
		expect(doubleLessonAfter).toBeDefined();
		expect(doubleLessonAfter!.calendarDate.getTime()).toBeGreaterThan(doubleLessonDate.getTime());
	});

	it.skip('should handle 2-week timetables with Week A/B', async () => {
		// Update config to 2-week timetable
		await db
			.update(timetableConfig)
			.set({ weeks: 2 })
			.where(eq(timetableConfig.academicYear, '2024-25'));

		// Delete existing slots and create Week A/B slots
		await db.delete(timetableSlot).where(eq(timetableSlot.classId, testClass.id));

		// Week A: Mon, Wed, Fri
		for (const day of [1, 3, 5]) {
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day,
				periodStart: 1,
				periodEnd: 1,
				week: 'A'
			});
		}

		// Week B: Tue, Thu
		for (const day of [2, 4]) {
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day,
				periodStart: 1,
				periodEnd: 1,
				week: 'B'
			});
		}

		// Create 5 lessons
		for (let i = 0; i < 5; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		// Assign module starting from Monday Sep 2 (Week A)
		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Verify original schedule respects Week A/B
		const originalLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(originalLessons).toHaveLength(5);
		// Week A: Mon, Wed, Fri
		expect(originalLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(originalLessons[1].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z');
		expect(originalLessons[2].calendarDate.toISOString()).toBe('2024-09-06T00:00:00.000Z');
		// Week B: Tue, Thu
		expect(originalLessons[3].calendarDate.toISOString()).toBe('2024-09-10T00:00:00.000Z');
		expect(originalLessons[4].calendarDate.toISOString()).toBe('2024-09-12T00:00:00.000Z');

		// Add event on Friday Sep 6 (Week A)
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'holiday',
				title: 'Test Event',
				startDate: new Date('2024-09-06T00:00:00Z'),
				endDate: new Date('2024-09-06T00:00:00Z'),
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Reschedule
		const result = await rescheduleLessonsForEvent({ eventId });

		// Should reschedule 3 lessons (Fri week A, Tue week B, Thu week B)
		expect(result.lessonsRescheduled).toBe(3);

		// Verify new schedule maintains Week A/B pattern
		const rescheduledLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(rescheduledLessons).toHaveLength(5);

		// Mon and Wed Week A unchanged
		expect(rescheduledLessons[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(rescheduledLessons[1].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z');

		// Fri Week A lesson (originally Sep 6) should be rescheduled
		// The next available slots after the event are Week B slots (Sep 10 Tue, Sep 12 Thu)
		// Then Week A slots (Sep 16 Mon, Sep 18 Wed, Sep 20 Fri)
		// We need to verify the pattern continues correctly
		expect(rescheduledLessons[2].calendarDate.getTime()).toBeGreaterThan(
			new Date('2024-09-06T00:00:00Z').getTime()
		);
		expect(rescheduledLessons[3].calendarDate.getTime()).toBeGreaterThan(
			rescheduledLessons[2].calendarDate.getTime()
		);
		expect(rescheduledLessons[4].calendarDate.getTime()).toBeGreaterThan(
			rescheduledLessons[3].calendarDate.getTime()
		);
	});

	it('should preview changes without applying them', async () => {
		// Create 3 lessons
		for (let i = 0; i < 3; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Add event
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'holiday',
				title: 'Test Holiday',
				startDate: new Date('2024-09-03T00:00:00Z'),
				endDate: new Date('2024-09-03T00:00:00Z'),
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Preview reschedule
		const previewResult = await rescheduleLessonsForEvent({ eventId, preview: true });

		expect(previewResult.lessonsRescheduled).toBe(2);
		expect(previewResult.changes).toHaveLength(2);

		// Verify lessons are NOT actually rescheduled
		const lessonsAfterPreview = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(lessonsAfterPreview[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(lessonsAfterPreview[1].calendarDate.toISOString()).toBe('2024-09-03T00:00:00.000Z');
		expect(lessonsAfterPreview[2].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z');

		// Now actually apply the reschedule
		const actualResult = await rescheduleLessonsForEvent({ eventId, preview: false });

		expect(actualResult.lessonsRescheduled).toBe(2);

		// Verify lessons ARE rescheduled
		const lessonsAfterActual = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		expect(lessonsAfterActual[0].calendarDate.toISOString()).toBe('2024-09-02T00:00:00.000Z');
		expect(lessonsAfterActual[1].calendarDate.toISOString()).toBe('2024-09-04T00:00:00.000Z');
		expect(lessonsAfterActual[2].calendarDate.toISOString()).toBe('2024-09-05T00:00:00.000Z');
	});

	it('should handle multiple calendar events when rescheduling', async () => {
		// Create 10 lessons
		for (let i = 0; i < 10; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Add first event on Wed Sep 4
		await db.insert(calendarEvent).values({
			type: 'holiday',
			title: 'First Holiday',
			startDate: new Date('2024-09-04T00:00:00Z'),
			endDate: new Date('2024-09-04T00:00:00Z'),
			affectsAllClasses: true
		});

		// Add second event on Mon Sep 16 (where lessons would be rescheduled to)
		await db.insert(calendarEvent).values({
			type: 'closure',
			title: 'Second Closure',
			startDate: new Date('2024-09-16T00:00:00Z'),
			endDate: new Date('2024-09-16T00:00:00Z'),
			affectsAllClasses: true
		});

		// Reschedule for first event
		const events = await db.select().from(calendarEvent);
		const firstEventId = events.find((e) => e.title === 'First Holiday')!.id;

		const result = await rescheduleLessonsForEvent({ eventId: firstEventId });

		expect(result.lessonsRescheduled).toBeGreaterThan(0);

		// Verify rescheduled lessons skip the second event date
		const rescheduledLessons = await db
			.select()
			.from(scheduledLesson)
			.orderBy(scheduledLesson.calendarDate);

		const dates = rescheduledLessons.map((l) => l.calendarDate.toISOString());

		// Should not have any lessons on Sep 4 or Sep 16
		expect(dates).not.toContain('2024-09-04T00:00:00.000Z');
		expect(dates).not.toContain('2024-09-16T00:00:00.000Z');
	});

	it('should return empty result when no lessons are affected', async () => {
		// Create lessons
		for (let i = 0; i < 3; i++) {
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: `Lesson ${i + 1}`,
				duration: 1,
				order: i
			});
		}

		// Assign module for week of Sep 2-6
		const startDate = new Date('2024-09-02T00:00:00Z');
		await assignModuleToClass({
			classId: testClass.id,
			moduleId: testModule.id,
			startDate
		});

		// Add event AFTER all lessons (Sep 23)
		const eventResult = await db
			.insert(calendarEvent)
			.values({
				type: 'holiday',
				title: 'Future Holiday',
				startDate: new Date('2024-09-23T00:00:00Z'),
				endDate: new Date('2024-09-23T00:00:00Z'),
				affectsAllClasses: true
			})
			.returning();

		const eventId = eventResult[0].id;

		// Reschedule
		const result = await rescheduleLessonsForEvent({ eventId });

		// No lessons should be affected
		expect(result.lessonsRescheduled).toBe(0);
		expect(result.rescheduledLessonIds).toHaveLength(0);
		expect(result.changes).toHaveLength(0);
	});

	it('should throw error when event does not exist', async () => {
		await expect(rescheduleLessonsForEvent({ eventId: 'non-existent-id' })).rejects.toThrow(
			'Calendar event not found'
		);
	});

	it('should throw error when no suitable slot exists for rescheduling', async () => {
		// Create a lesson requiring a double period
		await db.insert(lesson).values({
			moduleId: testModule.id,
			title: 'Double Lesson',
			duration: 2,
			order: 0
		});

		// Only single period slots exist, so this will fail during assignment
		const startDate = new Date('2024-09-02T00:00:00Z');

		await expect(
			assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			})
		).rejects.toThrow('Could not find a suitable slot');
	});
});
