import { describe, it, expect, beforeEach } from 'vitest';
import { assignModuleToClass, findNextAvailableSlot } from './assign-module';
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

describe('assignModuleToClass', () => {
	let testExamSpec: { id: string };
	let testClass: { id: string };
	let testModule: { id: string };
	let testTopic: { id: string };
	let testSpecPoint1: { id: string };
	// let testSpecPoint2: { id: string }; // Reserved for future use

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

		// Create test topic and spec points
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

		const specPoints1 = await db
			.insert(specPoint)
			.values({
				topicId: testTopic.id,
				reference: '4.1.1',
				content: 'Forces and their interactions',
				sortOrder: 1
			})
			.returning();
		testSpecPoint1 = specPoints1[0];

		// Reserved for future multi-spec-point tests
		await db.insert(specPoint).values({
			topicId: testTopic.id,
			reference: '4.1.2',
			content: 'Work done and energy transfer',
			sortOrder: 2
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

		// Create timetable configuration
		await db.insert(timetableConfig).values({
			academicYear: '2024-25',
			weeks: 1,
			periodsPerDay: 6,
			daysPerWeek: 5
		});

		// Create test module
		const modules = await db
			.insert(module)
			.values({
				name: 'Forces and Motion',
				description: 'Introduction to forces',
				targetSpecId: testExamSpec.id
			})
			.returning();
		testModule = modules[0];
	});

	describe('basic module assignment', () => {
		it('should create module assignment with specified start date', async () => {
			// Create timetable slots for the class
			await db.insert(timetableSlot).values([
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1 }, // Monday period 1
				{ classId: testClass.id, day: 3, periodStart: 2, periodEnd: 2 } // Wednesday period 2
			]);

			// Create lessons in the module
			await db.insert(lesson).values([
				{
					moduleId: testModule.id,
					title: 'Introduction to Forces',
					content: 'What is a force?',
					duration: 1,
					order: 1
				},
				{
					moduleId: testModule.id,
					title: 'Types of Forces',
					content: 'Contact and non-contact forces',
					duration: 1,
					order: 2
				}
			]);

			const startDate = new Date('2024-09-02T00:00:00.000Z'); // A Monday in UTC

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			// Verify module assignment was created
			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			expect(assignments).toHaveLength(1);
			expect(assignments[0].moduleId).toBe(testModule.id);
			expect(assignments[0].startDate).toEqual(startDate);

			// Verify scheduled lessons were created
			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(2);

			// First lesson should be on Monday (2024-09-02)
			expect(scheduled[0].title).toBe('Introduction to Forces');
			expect(scheduled[0].content).toBe('What is a force?');
			expect(scheduled[0].duration).toBe(1);
			expect(scheduled[0].calendarDate.toISOString()).toBe(
				new Date('2024-09-02T00:00:00.000Z').toISOString()
			);
			expect(scheduled[0].order).toBe(1);

			// Second lesson should be on Wednesday (2024-09-04)
			expect(scheduled[1].title).toBe('Types of Forces');
			expect(scheduled[1].content).toBe('Contact and non-contact forces');
			expect(scheduled[1].duration).toBe(1);
			expect(scheduled[1].calendarDate.toISOString()).toBe(
				new Date('2024-09-04T00:00:00.000Z').toISOString()
			);
			expect(scheduled[1].order).toBe(2);
		});

		it('should copy spec point links from lesson to scheduled lesson', async () => {
			// Create timetable slot
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day: 1,
				periodStart: 1,
				periodEnd: 1
			});

			// Create lesson with spec point link
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Forces Lesson',
					duration: 1,
					order: 1
				})
				.returning();

			await db.insert(lessonSpecPoint).values({
				lessonId: lessons[0].id,
				specPointId: testSpecPoint1.id
			});

			const startDate = new Date('2024-09-02T00:00:00.000Z');

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			// Verify spec point link was copied
			const scheduledSpecPoints = await db
				.select()
				.from(scheduledLessonSpecPoint)
				.where(eq(scheduledLessonSpecPoint.scheduledLessonId, scheduled[0].id));

			expect(scheduledSpecPoints).toHaveLength(1);
			expect(scheduledSpecPoints[0].specPointId).toBe(testSpecPoint1.id);
		});

		it('should handle lessons with null content', async () => {
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day: 1,
				periodStart: 1,
				periodEnd: 1
			});

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson without content',
				content: null,
				duration: 1,
				order: 1
			});

			const startDate = new Date('2024-09-02T00:00:00.000Z');

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(1);
			expect(scheduled[0].content).toBeNull();
		});
	});

	describe('double period handling', () => {
		it('should place double-period lesson in double-period slot', async () => {
			// Create a double-period slot (periods 1-2)
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day: 1,
				periodStart: 1,
				periodEnd: 2
			});

			// Create a double-period lesson
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Practical Investigation',
				content: 'Extended practical work',
				duration: 2,
				order: 1
			});

			const startDate = new Date('2024-09-02T00:00:00.000Z');

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(1);
			expect(scheduled[0].duration).toBe(2);

			// Verify it's placed in the double-period slot
			const slots = await db
				.select()
				.from(timetableSlot)
				.where(eq(timetableSlot.id, scheduled[0].timetableSlotId!));

			expect(slots).toHaveLength(1);
			expect(slots[0].periodStart).toBe(1);
			expect(slots[0].periodEnd).toBe(2);
		});

		it('should not place double-period lesson in single-period slot', async () => {
			// Create only single-period slots
			await db.insert(timetableSlot).values([
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1 },
				{ classId: testClass.id, day: 1, periodStart: 2, periodEnd: 2 },
				{ classId: testClass.id, day: 2, periodStart: 1, periodEnd: 1 }
			]);

			// Create a double-period lesson
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Double Lesson',
				duration: 2,
				order: 1
			});

			const startDate = new Date('2024-09-02T00:00:00.000Z');

			// This should throw an error because no double-period slot is available
			await expect(
				assignModuleToClass({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate
				})
			).rejects.toThrow(/suitable slot/i);
		});

		it('should handle mix of single and double period lessons', async () => {
			// Create mix of single and double slots
			await db.insert(timetableSlot).values([
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1 }, // Single
				{ classId: testClass.id, day: 2, periodStart: 1, periodEnd: 2 }, // Double
				{ classId: testClass.id, day: 3, periodStart: 1, periodEnd: 1 } // Single
			]);

			// Create mix of lessons
			await db.insert(lesson).values([
				{ moduleId: testModule.id, title: 'Lesson 1', duration: 1, order: 1 },
				{ moduleId: testModule.id, title: 'Practical', duration: 2, order: 2 },
				{ moduleId: testModule.id, title: 'Lesson 3', duration: 1, order: 3 }
			]);

			const startDate = new Date('2024-09-02T00:00:00.000Z'); // Monday

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(3);

			// Lesson 1 on Monday (single)
			expect(scheduled[0].title).toBe('Lesson 1');
			expect(scheduled[0].duration).toBe(1);
			expect(scheduled[0].calendarDate.toISOString()).toBe(
				new Date('2024-09-02T00:00:00.000Z').toISOString()
			);

			// Practical on Tuesday (double)
			expect(scheduled[1].title).toBe('Practical');
			expect(scheduled[1].duration).toBe(2);
			expect(scheduled[1].calendarDate.toISOString()).toBe(
				new Date('2024-09-03T00:00:00.000Z').toISOString()
			);

			// Lesson 3 on Wednesday (single)
			expect(scheduled[2].title).toBe('Lesson 3');
			expect(scheduled[2].duration).toBe(1);
			expect(scheduled[2].calendarDate.toISOString()).toBe(
				new Date('2024-09-04T00:00:00.000Z').toISOString()
			);
		});
	});

	describe('2-week timetable handling', () => {
		beforeEach(async () => {
			// Update timetable config to 2-week cycle
			await db
				.update(timetableConfig)
				.set({ weeks: 2 })
				.where(eq(timetableConfig.academicYear, '2024-25'));
		});

		it('should respect Week A and Week B slots', async () => {
			// Create slots in Week A and Week B
			await db.insert(timetableSlot).values([
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1, week: 'A' },
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1, week: 'B' },
				{ classId: testClass.id, day: 3, periodStart: 2, periodEnd: 2, week: 'A' }
			]);

			// Create 3 lessons
			await db.insert(lesson).values([
				{ moduleId: testModule.id, title: 'Lesson 1', duration: 1, order: 1 },
				{ moduleId: testModule.id, title: 'Lesson 2', duration: 1, order: 2 },
				{ moduleId: testModule.id, title: 'Lesson 3', duration: 1, order: 3 }
			]);

			// Start on Monday of Week A (2024-09-02 is Week A)
			const startDate = new Date('2024-09-02T00:00:00.000Z');

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id,
				startDate
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(3);

			// Lesson 1: Monday Week A (2024-09-02)
			expect(scheduled[0].calendarDate.toISOString()).toBe(
				new Date('2024-09-02T00:00:00.000Z').toISOString()
			);

			// Lesson 2: Wednesday Week A (2024-09-04)
			expect(scheduled[1].calendarDate.toISOString()).toBe(
				new Date('2024-09-04T00:00:00.000Z').toISOString()
			);

			// Lesson 3: Monday Week B (2024-09-09, next Monday is Week B)
			expect(scheduled[2].calendarDate.toISOString()).toBe(
				new Date('2024-09-09T00:00:00.000Z').toISOString()
			);
		});
	});

	describe('next available slot', () => {
		it('should find next available slot when no start date specified', async () => {
			// Create slots
			await db.insert(timetableSlot).values([
				{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1 },
				{ classId: testClass.id, day: 3, periodStart: 2, periodEnd: 2 }
			]);

			// Create a lesson
			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'First Lesson',
				duration: 1,
				order: 1
			});

			// Don't specify start date - should use next available
			const today = new Date();

			await assignModuleToClass({
				classId: testClass.id,
				moduleId: testModule.id
				// No startDate provided
			});

			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.classId, testClass.id));

			expect(assignments).toHaveLength(1);

			// Start date should be today or later
			expect(assignments[0].startDate.getTime()).toBeGreaterThanOrEqual(
				new Date(today.setHours(0, 0, 0, 0)).getTime()
			);

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(1);
			expect(scheduled[0].calendarDate.getTime()).toBeGreaterThanOrEqual(
				new Date(today.setHours(0, 0, 0, 0)).getTime()
			);
		});

		it('should skip slots that are already occupied', async () => {
			// Create slots
			const slots = await db
				.insert(timetableSlot)
				.values([
					{ classId: testClass.id, day: 1, periodStart: 1, periodEnd: 1 },
					{ classId: testClass.id, day: 2, periodStart: 1, periodEnd: 1 },
					{ classId: testClass.id, day: 3, periodStart: 1, periodEnd: 1 }
				])
				.returning();

			// Create an existing assignment occupying the first slot
			const existingAssignment = await db
				.insert(moduleAssignment)
				.values({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-02')
				})
				.returning();

			const existingLesson = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Existing Lesson',
					duration: 1,
					order: 1
				})
				.returning();

			await db.insert(scheduledLesson).values({
				assignmentId: existingAssignment[0].id,
				lessonId: existingLesson[0].id,
				calendarDate: new Date('2024-09-02'),
				timetableSlotId: slots[0].id,
				title: 'Existing Lesson',
				duration: 1,
				order: 1
			});

			// Create a new module with one lesson
			const newModule = await db
				.insert(module)
				.values({
					name: 'New Module',
					targetSpecId: testExamSpec.id
				})
				.returning();

			await db.insert(lesson).values({
				moduleId: newModule[0].id,
				title: 'New Lesson',
				duration: 1,
				order: 1
			});

			// Assign new module starting from 2024-09-02
			await assignModuleToClass({
				classId: testClass.id,
				moduleId: newModule[0].id,
				startDate: new Date('2024-09-02')
			});

			// Get the new scheduled lesson
			const assignments = await db
				.select()
				.from(moduleAssignment)
				.where(eq(moduleAssignment.moduleId, newModule[0].id));

			const scheduled = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.assignmentId, assignments[0].id));

			expect(scheduled).toHaveLength(1);

			// Should be placed on Tuesday (next available) not Monday (occupied)
			expect(scheduled[0].calendarDate.toISOString()).toBe(
				new Date('2024-09-03T00:00:00.000Z').toISOString()
			);
		});
	});

	describe('validation', () => {
		it('should throw error if class has no timetable slots', async () => {
			// Don't create any timetable slots

			await db.insert(lesson).values({
				moduleId: testModule.id,
				title: 'Lesson',
				duration: 1,
				order: 1
			});

			await expect(
				assignModuleToClass({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-02')
				})
			).rejects.toThrow(/no timetable slots/i);
		});

		it('should throw error if module has no lessons', async () => {
			// Create timetable slot but no lessons
			await db.insert(timetableSlot).values({
				classId: testClass.id,
				day: 1,
				periodStart: 1,
				periodEnd: 1
			});

			await expect(
				assignModuleToClass({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-02')
				})
			).rejects.toThrow(/no lessons/i);
		});

		it('should throw error if class does not exist', async () => {
			await expect(
				assignModuleToClass({
					classId: 'non-existent-id',
					moduleId: testModule.id,
					startDate: new Date('2024-09-02')
				})
			).rejects.toThrow(/class not found/i);
		});

		it('should throw error if module does not exist', async () => {
			await expect(
				assignModuleToClass({
					classId: testClass.id,
					moduleId: 'non-existent-id',
					startDate: new Date('2024-09-02')
				})
			).rejects.toThrow(/module not found/i);
		});
	});
});

describe('findNextAvailableSlot', () => {
	let testClass: { id: string };
	let testExamSpec: { id: string };

	beforeEach(async () => {
		// Clean up
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(timetableSlot);
		await db.delete(timetableConfig);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(teachingClass);
		await db.delete(examSpec);

		// Create test data
		const specs = await db
			.insert(examSpec)
			.values({
				board: 'AQA',
				level: 'GCSE',
				name: 'AQA GCSE Physics (8463)'
			})
			.returning();
		testExamSpec = specs[0];

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

		await db.insert(timetableConfig).values({
			academicYear: '2024-25',
			weeks: 1,
			periodsPerDay: 6,
			daysPerWeek: 5
		});
	});

	it('should return next Monday if today is Friday and class has Monday slot', async () => {
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 1, // Monday
			periodStart: 1,
			periodEnd: 1
		});

		// Simulate today is Friday 2024-09-06
		const friday = new Date('2024-09-06T00:00:00.000Z');
		const nextSlot = await findNextAvailableSlot(testClass.id, friday);

		// Should be Monday 2024-09-09
		expect(nextSlot.toISOString()).toBe(new Date('2024-09-09T00:00:00.000Z').toISOString());
	});

	it('should return today if today matches a timetable slot day', async () => {
		await db.insert(timetableSlot).values({
			classId: testClass.id,
			day: 1, // Monday
			periodStart: 1,
			periodEnd: 1
		});

		// Today is Monday
		const monday = new Date('2024-09-02T00:00:00.000Z');
		const nextSlot = await findNextAvailableSlot(testClass.id, monday);

		expect(nextSlot.toISOString()).toBe(monday.toISOString());
	});

	it('should throw error if class has no timetable slots', async () => {
		const today = new Date('2024-09-02');

		await expect(findNextAvailableSlot(testClass.id, today)).rejects.toThrow(/no timetable slots/i);
	});
});
