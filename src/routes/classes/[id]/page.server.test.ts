/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Test file with mock types for SvelteKit server functions
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from './+page.server.js';
import { db } from '$lib/server/db';
import {
	teachingClass,
	course,
	timetableSlot,
	scheduledLesson,
	moduleAssignment,
	module,
	lesson
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

describe('Class Detail Page Server', () => {
	let testCourse: { id: string };
	let testClass: { id: string };

	beforeEach(async () => {
		// Clean up test data before each test
		await db.delete(scheduledLesson);
		await db.delete(moduleAssignment);
		await db.delete(lesson);
		await db.delete(module);
		await db.delete(timetableSlot);
		await db.delete(teachingClass);
		await db.delete(course);

		// Create a test course
		const courses = await db.insert(course).values({ name: 'AQA GCSE Physics' }).returning();
		testCourse = courses[0];

		// Create a test class
		const classes = await db
			.insert(teachingClass)
			.values({
				name: '11X/Ph1',
				yearGroup: 11,
				courseId: testCourse.id,
				academicYear: '2024-25',
				studentCount: 28,
				room: 'Lab 3',
				notes: 'Active class'
			})
			.returning();
		testClass = classes[0];
	});

	describe('load function', () => {
		it('should load class details with course information', async () => {
			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.class).toBeDefined();
			expect(result.class.id).toBe(testClass.id);
			expect(result.class.name).toBe('11X/Ph1');
			expect(result.class.yearGroup).toBe(11);
			expect(result.class.academicYear).toBe('2024-25');
			expect(result.class.studentCount).toBe(28);
			expect(result.class.room).toBe('Lab 3');
			expect(result.class.notes).toBe('Active class');
			expect(result.class.course).toBeDefined();
			expect(result.class.course.name).toBe('AQA GCSE Physics');
		});

		it('should load empty timetable slots when none exist', async () => {
			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.timetableSlots).toEqual([]);
		});

		it('should load timetable slots for the class', async () => {
			// Add some timetable slots
			await db.insert(timetableSlot).values([
				{
					classId: testClass.id,
					day: 1, // Monday
					periodStart: 1,
					periodEnd: 1,
					week: null
				},
				{
					classId: testClass.id,
					day: 3, // Wednesday
					periodStart: 3,
					periodEnd: 4, // Double period
					week: null
				}
			]);

			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.timetableSlots).toHaveLength(2);
			expect(result.timetableSlots[0].day).toBe(1);
			expect(result.timetableSlots[0].periodStart).toBe(1);
			expect(result.timetableSlots[0].periodEnd).toBe(1);
			expect(result.timetableSlots[1].day).toBe(3);
			expect(result.timetableSlots[1].periodStart).toBe(3);
			expect(result.timetableSlots[1].periodEnd).toBe(4);
		});

		it('should load timetable slots with week A/B for 2-week timetables', async () => {
			await db.insert(timetableSlot).values([
				{
					classId: testClass.id,
					day: 1,
					periodStart: 1,
					periodEnd: 1,
					week: 'A'
				},
				{
					classId: testClass.id,
					day: 1,
					periodStart: 1,
					periodEnd: 1,
					week: 'B'
				}
			]);

			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.timetableSlots).toHaveLength(2);
			expect(result.timetableSlots[0].week).toBe('A');
			expect(result.timetableSlots[1].week).toBe('B');
		});

		it('should load empty scheduled lessons when none exist', async () => {
			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.scheduledLessons).toEqual([]);
		});

		it('should load scheduled lessons in chronological order', async () => {
			// Create a module and lessons for assignment
			const modules = await db
				.insert(module)
				.values({
					name: 'Forces and Motion',
					courseId: testCourse.id
				})
				.returning();
			const testModule = modules[0];

			const lessons = await db
				.insert(lesson)
				.values([
					{
						moduleId: testModule.id,
						title: "Newton's First Law",
						content: 'Introduction to inertia',
						duration: 1,
						order: 1
					},
					{
						moduleId: testModule.id,
						title: "Newton's Second Law",
						content: 'F = ma',
						duration: 1,
						order: 2
					}
				])
				.returning();

			// Create a module assignment
			const assignments = await db
				.insert(moduleAssignment)
				.values({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-10')
				})
				.returning();
			const testAssignment = assignments[0];

			// Create scheduled lessons
			await db.insert(scheduledLesson).values([
				{
					assignmentId: testAssignment.id,
					lessonId: lessons[0].id,
					calendarDate: new Date('2024-09-15'),
					timetableSlotId: null,
					title: lessons[0].title,
					content: lessons[0].content,
					duration: lessons[0].duration,
					order: 1
				},
				{
					assignmentId: testAssignment.id,
					lessonId: lessons[1].id,
					calendarDate: new Date('2024-09-10'), // Earlier date
					timetableSlotId: null,
					title: lessons[1].title,
					content: lessons[1].content,
					duration: lessons[1].duration,
					order: 2
				}
			]);

			const result = await load({
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result.scheduledLessons).toHaveLength(2);
			// Should be ordered by calendar date (earliest first)
			expect(result.scheduledLessons[0].title).toBe("Newton's Second Law");
			expect(result.scheduledLessons[1].title).toBe("Newton's First Law");
		});

		it('should throw 404 error when class does not exist', async () => {
			const nonExistentId = crypto.randomUUID();

			await expect(
				load({
					params: { id: nonExistentId }
				} as RequestEvent)
			).rejects.toThrow();
		});
	});

	describe('updateClass action', () => {
		it('should update class with all fields', async () => {
			const formData = new FormData();
			formData.append('name', 'Updated Class Name');
			formData.append('yearGroup', '12');
			formData.append('academicYear', '2025-26');
			formData.append('studentCount', '30');
			formData.append('room', 'Lab 5');
			formData.append('notes', 'Updated notes');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateClass({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const updated = await db
				.select()
				.from(teachingClass)
				.where((t) => t.id === testClass.id);

			expect(updated[0].name).toBe('Updated Class Name');
			expect(updated[0].yearGroup).toBe(12);
			expect(updated[0].academicYear).toBe('2025-26');
			expect(updated[0].studentCount).toBe(30);
			expect(updated[0].room).toBe('Lab 5');
			expect(updated[0].notes).toBe('Updated notes');
		});

		it('should update class with optional fields set to null', async () => {
			const formData = new FormData();
			formData.append('name', 'Updated Class');
			formData.append('yearGroup', '11');
			formData.append('academicYear', '2024-25');
			formData.append('studentCount', '');
			formData.append('room', '');
			formData.append('notes', '');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateClass({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const updated = await db
				.select()
				.from(teachingClass)
				.where((t) => t.id === testClass.id);

			expect(updated[0].studentCount).toBeNull();
			expect(updated[0].room).toBeNull();
			expect(updated[0].notes).toBeNull();
		});

		it('should validate name is required', async () => {
			const formData = new FormData();
			formData.append('name', '   ');
			formData.append('yearGroup', '11');
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateClass({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Class name is required');
		});

		it('should validate year group is between 7 and 13', async () => {
			const formData = new FormData();
			formData.append('name', 'Test Class');
			formData.append('yearGroup', '6');
			formData.append('academicYear', '2024-25');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateClass({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Year group must be between 7 and 13');
		});
	});

	describe('addSlot action', () => {
		it('should add a single period slot', async () => {
			const formData = new FormData();
			formData.append('day', '1');
			formData.append('periodStart', '3');
			formData.append('periodEnd', '3');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const slots = await db
				.select()
				.from(timetableSlot)
				.where((s) => s.classId === testClass.id);

			expect(slots).toHaveLength(1);
			expect(slots[0].day).toBe(1);
			expect(slots[0].periodStart).toBe(3);
			expect(slots[0].periodEnd).toBe(3);
			expect(slots[0].week).toBeNull();
		});

		it('should add a double period slot', async () => {
			const formData = new FormData();
			formData.append('day', '2');
			formData.append('periodStart', '1');
			formData.append('periodEnd', '2');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const slots = await db
				.select()
				.from(timetableSlot)
				.where((s) => s.classId === testClass.id);

			expect(slots).toHaveLength(1);
			expect(slots[0].periodStart).toBe(1);
			expect(slots[0].periodEnd).toBe(2);
		});

		it('should add slot with week A/B', async () => {
			const formData = new FormData();
			formData.append('day', '1');
			formData.append('periodStart', '1');
			formData.append('periodEnd', '1');
			formData.append('week', 'A');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const slots = await db
				.select()
				.from(timetableSlot)
				.where((s) => s.classId === testClass.id);

			expect(slots).toHaveLength(1);
			expect(slots[0].week).toBe('A');
		});

		it('should validate day is between 1 and 7', async () => {
			const formData = new FormData();
			formData.append('day', '8');
			formData.append('periodStart', '1');
			formData.append('periodEnd', '1');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Day must be between 1 (Monday) and 7 (Sunday)');
		});

		it('should validate period start is positive', async () => {
			const formData = new FormData();
			formData.append('day', '1');
			formData.append('periodStart', '0');
			formData.append('periodEnd', '1');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Period start must be at least 1');
		});

		it('should validate period end is not before period start', async () => {
			const formData = new FormData();
			formData.append('day', '1');
			formData.append('periodStart', '3');
			formData.append('periodEnd', '2');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Period end cannot be before period start');
		});

		it('should validate week is A or B when provided', async () => {
			const formData = new FormData();
			formData.append('day', '1');
			formData.append('periodStart', '1');
			formData.append('periodEnd', '1');
			formData.append('week', 'C');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.addSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Week must be A or B');
		});
	});

	describe('updateSlot action', () => {
		let testSlot: { id: string };

		beforeEach(async () => {
			const slots = await db
				.insert(timetableSlot)
				.values({
					classId: testClass.id,
					day: 1,
					periodStart: 1,
					periodEnd: 1,
					week: null
				})
				.returning();
			testSlot = slots[0];
		});

		it('should update an existing slot', async () => {
			const formData = new FormData();
			formData.append('slotId', testSlot.id);
			formData.append('day', '3');
			formData.append('periodStart', '4');
			formData.append('periodEnd', '5');
			formData.append('week', 'B');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const updated = await db
				.select()
				.from(timetableSlot)
				.where((s) => s.id === testSlot.id);

			expect(updated[0].day).toBe(3);
			expect(updated[0].periodStart).toBe(4);
			expect(updated[0].periodEnd).toBe(5);
			expect(updated[0].week).toBe('B');
		});

		it('should validate slot belongs to the class', async () => {
			// Create another class
			const otherClasses = await db
				.insert(teachingClass)
				.values({
					name: 'Other Class',
					yearGroup: 10,
					courseId: testCourse.id,
					academicYear: '2024-25'
				})
				.returning();
			const otherClass = otherClasses[0];

			// Create a slot for the other class
			const otherSlots = await db
				.insert(timetableSlot)
				.values({
					classId: otherClass.id,
					day: 2,
					periodStart: 2,
					periodEnd: 2,
					week: null
				})
				.returning();
			const otherSlot = otherSlots[0];

			const formData = new FormData();
			formData.append('slotId', otherSlot.id);
			formData.append('day', '3');
			formData.append('periodStart', '3');
			formData.append('periodEnd', '3');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Slot not found or does not belong to this class');
		});
	});

	describe('deleteSlot action', () => {
		let testSlot: { id: string };

		beforeEach(async () => {
			const slots = await db
				.insert(timetableSlot)
				.values({
					classId: testClass.id,
					day: 1,
					periodStart: 1,
					periodEnd: 1,
					week: null
				})
				.returning();
			testSlot = slots[0];
		});

		it('should delete a slot', async () => {
			const formData = new FormData();
			formData.append('slotId', testSlot.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.deleteSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			const slots = await db
				.select()
				.from(timetableSlot)
				.where((s) => s.id === testSlot.id);

			expect(slots).toHaveLength(0);
		});

		it('should validate slot belongs to the class', async () => {
			// Create another class
			const otherClasses = await db
				.insert(teachingClass)
				.values({
					name: 'Other Class',
					yearGroup: 10,
					courseId: testCourse.id,
					academicYear: '2024-25'
				})
				.returning();
			const otherClass = otherClasses[0];

			// Create a slot for the other class
			const otherSlots = await db
				.insert(timetableSlot)
				.values({
					classId: otherClass.id,
					day: 2,
					periodStart: 2,
					periodEnd: 2,
					week: null
				})
				.returning();
			const otherSlot = otherSlots[0];

			const formData = new FormData();
			formData.append('slotId', otherSlot.id);

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.deleteSlot({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Slot not found or does not belong to this class');
		});
	});

	describe('updateScheduledLesson action', () => {
		it('should update a scheduled lesson successfully', async () => {
			// Create a module
			const modules = await db
				.insert(module)
				.values({
					name: 'Forces and Motion',
					courseId: testCourse.id
				})
				.returning();
			const testModule = modules[0];

			// Create a lesson in the module
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Introduction to Forces',
					content: 'Original content',
					duration: 1,
					order: 1
				})
				.returning();
			const testLesson = lessons[0];

			// Create a module assignment
			const assignments = await db
				.insert(moduleAssignment)
				.values({
					classId: testClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-01')
				})
				.returning();
			const assignment = assignments[0];

			// Create a scheduled lesson
			const scheduledLessons = await db
				.insert(scheduledLesson)
				.values({
					assignmentId: assignment.id,
					lessonId: testLesson.id,
					calendarDate: new Date('2024-09-02'),
					timetableSlotId: null,
					title: 'Introduction to Forces',
					content: 'Original content',
					duration: 1,
					order: 1
				})
				.returning();
			const scheduled = scheduledLessons[0];

			const formData = new FormData();
			formData.append('lessonId', scheduled.id);
			formData.append('title', 'Updated Forces Lesson');
			formData.append('content', 'Updated content with more details');
			formData.append('duration', '2');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateScheduledLesson({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.success).toBe(true);

			// Verify the lesson was updated
			const updated = await db
				.select()
				.from(scheduledLesson)
				.where(eq(scheduledLesson.id, scheduled.id));
			expect(updated[0].title).toBe('Updated Forces Lesson');
			expect(updated[0].content).toBe('Updated content with more details');
			expect(updated[0].duration).toBe(2);
		});

		it('should validate required fields', async () => {
			const formData = new FormData();
			formData.append('lessonId', 'test-id');
			formData.append('title', '');
			formData.append('content', '');
			formData.append('duration', '1');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateScheduledLesson({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Lesson title is required');
		});

		it('should validate duration range', async () => {
			const formData = new FormData();
			formData.append('lessonId', 'test-id');
			formData.append('title', 'Test Lesson');
			formData.append('content', '');
			formData.append('duration', '15');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			const result = await actions.updateScheduledLesson({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Duration must be between 1 and 10 periods');
		});

		it('should reject updates to lessons from other classes', async () => {
			// Create another class
			const otherClasses = await db
				.insert(teachingClass)
				.values({
					name: 'Other Class',
					yearGroup: 10,
					courseId: testCourse.id,
					academicYear: '2024-25'
				})
				.returning();
			const otherClass = otherClasses[0];

			// Create a module
			const modules = await db
				.insert(module)
				.values({
					name: 'Test Module',
					courseId: testCourse.id
				})
				.returning();
			const testModule = modules[0];

			// Create a lesson
			const lessons = await db
				.insert(lesson)
				.values({
					moduleId: testModule.id,
					title: 'Test Lesson',
					order: 1
				})
				.returning();
			const testLesson = lessons[0];

			// Create assignment for OTHER class
			const assignments = await db
				.insert(moduleAssignment)
				.values({
					classId: otherClass.id,
					moduleId: testModule.id,
					startDate: new Date('2024-09-01')
				})
				.returning();
			const assignment = assignments[0];

			// Create scheduled lesson for OTHER class
			const scheduledLessons = await db
				.insert(scheduledLesson)
				.values({
					assignmentId: assignment.id,
					lessonId: testLesson.id,
					calendarDate: new Date('2024-09-02'),
					timetableSlotId: null,
					title: 'Test Lesson',
					order: 1
				})
				.returning();
			const scheduled = scheduledLessons[0];

			const formData = new FormData();
			formData.append('lessonId', scheduled.id);
			formData.append('title', 'Updated');
			formData.append('content', '');
			formData.append('duration', '1');

			const mockRequest = {
				formData: async () => formData
			} as Request;

			// Try to update from testClass context
			const result = await actions.updateScheduledLesson({
				request: mockRequest,
				params: { id: testClass.id }
			} as RequestEvent);

			expect(result?.error).toBe('Lesson not found or does not belong to this class');
		});
	});
});
