import { db } from '$lib/server/db';
import {
	teachingClass,
	examSpec,
	timetableSlot,
	scheduledLesson,
	moduleAssignment
} from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { pushLesson } from '$lib/server/scheduling/push-lesson';

export const load: PageServerLoad = async ({ params }) => {
	const classId = params.id;

	// Get class details with exam specification
	const classes = await db
		.select({
			id: teachingClass.id,
			name: teachingClass.name,
			yearGroup: teachingClass.yearGroup,
			academicYear: teachingClass.academicYear,
			studentCount: teachingClass.studentCount,
			room: teachingClass.room,
			notes: teachingClass.notes,
			createdAt: teachingClass.createdAt,
			updatedAt: teachingClass.updatedAt,
			examSpec: {
				id: examSpec.id,
				board: examSpec.board,
				level: examSpec.level,
				name: examSpec.name,
				specCode: examSpec.specCode,
				specYear: examSpec.specYear
			}
		})
		.from(teachingClass)
		.leftJoin(examSpec, eq(teachingClass.examSpecId, examSpec.id))
		.where(eq(teachingClass.id, classId));

	if (classes.length === 0) {
		throw error(404, 'Class not found');
	}

	const classData = classes[0];

	// Get timetable slots for this class
	const slots = await db
		.select()
		.from(timetableSlot)
		.where(eq(timetableSlot.classId, classId))
		.orderBy(asc(timetableSlot.day), asc(timetableSlot.periodStart));

	// Get scheduled lessons for this class
	const lessons = await db
		.select({
			id: scheduledLesson.id,
			assignmentId: scheduledLesson.assignmentId,
			lessonId: scheduledLesson.lessonId,
			calendarDate: scheduledLesson.calendarDate,
			timetableSlotId: scheduledLesson.timetableSlotId,
			title: scheduledLesson.title,
			content: scheduledLesson.content,
			duration: scheduledLesson.duration,
			order: scheduledLesson.order,
			createdAt: scheduledLesson.createdAt,
			updatedAt: scheduledLesson.updatedAt
		})
		.from(scheduledLesson)
		.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
		.where(eq(moduleAssignment.classId, classId))
		.orderBy(asc(scheduledLesson.calendarDate), asc(scheduledLesson.order));

	return {
		class: classData,
		timetableSlots: slots,
		scheduledLessons: lessons
	};
};

export const actions: Actions = {
	updateClass: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const yearGroup = parseInt(data.get('yearGroup')?.toString() || '0');
		const academicYear = data.get('academicYear')?.toString() || '';
		const studentCountStr = data.get('studentCount')?.toString();
		const room = data.get('room')?.toString();
		const notes = data.get('notes')?.toString();

		// Validation
		if (!name.trim()) {
			return { error: 'Class name is required' };
		}

		if (yearGroup < 7 || yearGroup > 13) {
			return { error: 'Year group must be between 7 and 13' };
		}

		if (!academicYear.trim()) {
			return { error: 'Academic year is required' };
		}

		// Handle optional student count
		let studentCount: number | null = null;
		if (studentCountStr && studentCountStr.trim()) {
			studentCount = parseInt(studentCountStr);
			if (isNaN(studentCount) || studentCount <= 0) {
				return { error: 'Student count must be a positive number' };
			}
		}

		// Update the class
		await db
			.update(teachingClass)
			.set({
				name: name.trim(),
				yearGroup,
				academicYear: academicYear.trim(),
				studentCount,
				room: room && room.trim() ? room.trim() : null,
				notes: notes && notes.trim() ? notes.trim() : null,
				updatedAt: new Date()
			})
			.where(eq(teachingClass.id, classId));

		return { success: true };
	},

	addSlot: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const day = parseInt(data.get('day')?.toString() || '0');
		const periodStart = parseInt(data.get('periodStart')?.toString() || '0');
		const periodEnd = parseInt(data.get('periodEnd')?.toString() || '0');
		const weekStr = data.get('week')?.toString();

		// Validation
		if (day < 1 || day > 7) {
			return { error: 'Day must be between 1 (Monday) and 7 (Sunday)' };
		}

		if (periodStart < 1) {
			return { error: 'Period start must be at least 1' };
		}

		if (periodEnd < periodStart) {
			return { error: 'Period end cannot be before period start' };
		}

		// Validate week if provided
		let week: 'A' | 'B' | null = null;
		if (weekStr && weekStr.trim()) {
			if (weekStr !== 'A' && weekStr !== 'B') {
				return { error: 'Week must be A or B' };
			}
			week = weekStr as 'A' | 'B';
		}

		// Insert new slot
		await db.insert(timetableSlot).values({
			classId,
			day,
			periodStart,
			periodEnd,
			week
		});

		return { success: true };
	},

	updateSlot: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const slotId = data.get('slotId')?.toString() || '';
		const day = parseInt(data.get('day')?.toString() || '0');
		const periodStart = parseInt(data.get('periodStart')?.toString() || '0');
		const periodEnd = parseInt(data.get('periodEnd')?.toString() || '0');
		const weekStr = data.get('week')?.toString();

		// Verify slot belongs to this class
		const slots = await db
			.select()
			.from(timetableSlot)
			.where(and(eq(timetableSlot.id, slotId), eq(timetableSlot.classId, classId)));

		if (slots.length === 0) {
			return { error: 'Slot not found or does not belong to this class' };
		}

		// Validation
		if (day < 1 || day > 7) {
			return { error: 'Day must be between 1 (Monday) and 7 (Sunday)' };
		}

		if (periodStart < 1) {
			return { error: 'Period start must be at least 1' };
		}

		if (periodEnd < periodStart) {
			return { error: 'Period end cannot be before period start' };
		}

		// Validate week if provided
		let week: 'A' | 'B' | null = null;
		if (weekStr && weekStr.trim()) {
			if (weekStr !== 'A' && weekStr !== 'B') {
				return { error: 'Week must be A or B' };
			}
			week = weekStr as 'A' | 'B';
		}

		// Update the slot
		await db
			.update(timetableSlot)
			.set({
				day,
				periodStart,
				periodEnd,
				week,
				updatedAt: new Date()
			})
			.where(eq(timetableSlot.id, slotId));

		return { success: true };
	},

	deleteSlot: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const slotId = data.get('slotId')?.toString() || '';

		// Verify slot belongs to this class
		const slots = await db
			.select()
			.from(timetableSlot)
			.where(and(eq(timetableSlot.id, slotId), eq(timetableSlot.classId, classId)));

		if (slots.length === 0) {
			return { error: 'Slot not found or does not belong to this class' };
		}

		// Delete the slot
		await db.delete(timetableSlot).where(eq(timetableSlot.id, slotId));

		return { success: true };
	},

	pushLessonForward: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString() || '';

		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		try {
			const result = await pushLesson({
				lessonId,
				direction: 'forward'
			});

			return {
				success: true,
				message: `Moved ${result.lessonsAffected} lesson(s) forward`
			};
		} catch (err) {
			const error = err as Error;
			return { error: error.message };
		}
	},

	pushLessonBack: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString() || '';

		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		try {
			const result = await pushLesson({
				lessonId,
				direction: 'back'
			});

			return {
				success: true,
				message: `Moved ${result.lessonsAffected} lesson(s) backward`
			};
		} catch (err) {
			const error = err as Error;
			return { error: error.message };
		}
	}
};
