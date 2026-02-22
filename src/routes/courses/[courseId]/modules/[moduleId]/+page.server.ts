import { db } from '$lib/server/db';
import { module, lesson, course } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAttachments, deleteAttachment } from '$lib/server/attachments';

export const load: PageServerLoad = async ({ params }) => {
	const { courseId, moduleId } = params;

	// Get course
	const courses = await db.select().from(course).where(eq(course.id, courseId));
	if (courses.length === 0) {
		throw error(404, 'Course not found');
	}
	const courseData = courses[0];

	// Get module
	const modules = await db.select().from(module).where(eq(module.id, moduleId));
	if (modules.length === 0) {
		throw error(404, 'Module not found');
	}
	const moduleData = modules[0];

	// Verify module belongs to course
	if (moduleData.courseId !== courseId) {
		throw error(404, 'Module not found in this course');
	}

	// Get lessons
	const lessons = await db
		.select()
		.from(lesson)
		.where(eq(lesson.moduleId, moduleId))
		.orderBy(asc(lesson.order));

	// Get attachments
	const moduleAttachments = await getAttachments('module', moduleId);

	return {
		course: courseData,
		module: moduleData,
		lessons,
		moduleAttachments
	};
};

export const actions: Actions = {
	updateModule: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const notes = data.get('notes')?.toString();

		if (!name.trim()) {
			return { error: 'Module name is required' };
		}

		await db
			.update(module)
			.set({
				name: name.trim(),
				notes: notes && notes.trim() ? notes.trim() : null,
				updatedAt: new Date()
			})
			.where(eq(module.id, params.moduleId));

		return { success: true };
	},

	deleteModule: async ({ params }) => {
		await db.delete(module).where(eq(module.id, params.moduleId));
		throw redirect(303, `/courses/${params.courseId}`);
	},

	addLesson: async ({ request, params }) => {
		const data = await request.formData();
		const title = data.get('title')?.toString() || '';
		const content = data.get('content')?.toString();
		const durationStr = data.get('duration')?.toString();
		const duration = durationStr ? parseInt(durationStr, 10) : 1;

		if (!title.trim()) {
			return { error: 'Lesson title is required' };
		}

		// Get next order number
		const existingLessons = await db
			.select({ order: lesson.order })
			.from(lesson)
			.where(eq(lesson.moduleId, params.moduleId))
			.orderBy(asc(lesson.order));

		const nextOrder =
			existingLessons.length > 0 ? Math.max(...existingLessons.map((l) => l.order)) + 1 : 1;

		await db.insert(lesson).values({
			moduleId: params.moduleId,
			title: title.trim(),
			content: content && content.trim() ? content.trim() : null,
			duration,
			order: nextOrder
		});

		return { success: true };
	},

	updateLesson: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString();
		const title = data.get('title')?.toString() || '';
		const content = data.get('content')?.toString();
		const durationStr = data.get('duration')?.toString();

		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		if (!title.trim()) {
			return { error: 'Lesson title is required' };
		}

		const updateData: {
			title: string;
			content: string | null;
			duration?: number;
			updatedAt: Date;
		} = {
			title: title.trim(),
			content: content && content.trim() ? content.trim() : null,
			updatedAt: new Date()
		};

		if (durationStr) {
			updateData.duration = parseInt(durationStr, 10);
		}

		await db.update(lesson).set(updateData).where(eq(lesson.id, lessonId));

		return { success: true };
	},

	deleteLesson: async ({ request, params }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString();

		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		const lessonToDelete = await db.select().from(lesson).where(eq(lesson.id, lessonId));

		if (lessonToDelete.length === 0) {
			return { error: 'Lesson not found' };
		}

		const deletedOrder = lessonToDelete[0].order;

		await db.delete(lesson).where(eq(lesson.id, lessonId));

		// Reorder remaining lessons
		const remainingLessons = await db
			.select()
			.from(lesson)
			.where(eq(lesson.moduleId, params.moduleId))
			.orderBy(asc(lesson.order));

		for (let i = 0; i < remainingLessons.length; i++) {
			if (remainingLessons[i].order > deletedOrder) {
				await db
					.update(lesson)
					.set({ order: remainingLessons[i].order - 1 })
					.where(eq(lesson.id, remainingLessons[i].id));
			}
		}

		return { success: true };
	},

	reorderLessons: async ({ request, params }) => {
		const data = await request.formData();
		const lessonIdsStr = data.get('lessonIds')?.toString();

		if (!lessonIdsStr) {
			return { error: 'Lesson IDs are required' };
		}

		const lessonIds = JSON.parse(lessonIdsStr) as string[];

		const existingLessons = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(eq(lesson.moduleId, params.moduleId));

		const existingIds = new Set(existingLessons.map((l) => l.id));
		const allValid = lessonIds.every((id) => existingIds.has(id));

		if (!allValid || lessonIds.length !== existingIds.size) {
			return { error: 'Invalid lesson IDs' };
		}

		for (let i = 0; i < lessonIds.length; i++) {
			await db
				.update(lesson)
				.set({ order: i + 1 })
				.where(eq(lesson.id, lessonIds[i]));
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
