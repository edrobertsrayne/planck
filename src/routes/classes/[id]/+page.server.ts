import { db } from '$lib/server/db';
import {
	teachingClass,
	examSpec,
	timetableSlot,
	scheduledLesson,
	moduleAssignment,
	scheduledLessonSpecPoint,
	specPoint,
	topic
} from '$lib/server/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { pushLesson } from '$lib/server/scheduling/push-lesson';
import { getAttachments, deleteAttachment } from '$lib/server/attachments';

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

	// Get spec point links for scheduled lessons
	const lessonIds = lessons.map((l) => l.id);
	const specPointLinks =
		lessonIds.length > 0
			? await db
					.select({
						scheduledLessonId: scheduledLessonSpecPoint.scheduledLessonId,
						specPointId: scheduledLessonSpecPoint.specPointId
					})
					.from(scheduledLessonSpecPoint)
					.where(inArray(scheduledLessonSpecPoint.scheduledLessonId, lessonIds))
			: [];

	// Get all available spec points from the class's exam specification
	const availableSpecPoints = classData.examSpec
		? await db
				.select({
					id: specPoint.id,
					reference: specPoint.reference,
					content: specPoint.content,
					topicId: specPoint.topicId
				})
				.from(specPoint)
				.innerJoin(topic, eq(specPoint.topicId, topic.id))
				.where(eq(topic.examSpecId, classData.examSpec.id))
				.orderBy(asc(specPoint.reference))
		: [];

	// Get attachments for this class
	const attachments = await getAttachments('class', classId);

	return {
		class: classData,
		timetableSlots: slots,
		scheduledLessons: lessons,
		specPointLinks,
		availableSpecPoints,
		attachments
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
	},

	updateScheduledLesson: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString() || '';
		const title = data.get('title')?.toString() || '';
		const content = data.get('content')?.toString() || '';
		const durationStr = data.get('duration')?.toString();
		const specPointIds = data.get('specPointIds')?.toString() || '';

		// Validation
		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		if (!title.trim()) {
			return { error: 'Lesson title is required' };
		}

		const duration = durationStr ? parseInt(durationStr) : 1;
		if (duration < 1 || duration > 10) {
			return { error: 'Duration must be between 1 and 10 periods' };
		}

		// Verify lesson belongs to a class assignment for this class
		const lessons = await db
			.select({
				id: scheduledLesson.id,
				assignmentId: scheduledLesson.assignmentId
			})
			.from(scheduledLesson)
			.innerJoin(moduleAssignment, eq(scheduledLesson.assignmentId, moduleAssignment.id))
			.where(and(eq(scheduledLesson.id, lessonId), eq(moduleAssignment.classId, classId)));

		if (lessons.length === 0) {
			return { error: 'Lesson not found or does not belong to this class' };
		}

		// Update the scheduled lesson
		await db
			.update(scheduledLesson)
			.set({
				title: title.trim(),
				content: content.trim() || null,
				duration,
				updatedAt: new Date()
			})
			.where(eq(scheduledLesson.id, lessonId));

		// Update spec point links if provided
		if (specPointIds) {
			// Delete existing spec point links
			await db
				.delete(scheduledLessonSpecPoint)
				.where(eq(scheduledLessonSpecPoint.scheduledLessonId, lessonId));

			// Add new spec point links
			const specPointIdArray = specPointIds
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id);

			if (specPointIdArray.length > 0) {
				await db.insert(scheduledLessonSpecPoint).values(
					specPointIdArray.map((specPointId) => ({
						scheduledLessonId: lessonId,
						specPointId
					}))
				);
			}
		}

		return { success: true };
	},

	deleteAttachment: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			throw error(400, 'Attachment ID is required');
		}

		await deleteAttachment(id);
		return { success: true };
	}
};
