import { db } from '$lib/server/db';
import { module, lesson, examSpec, specPoint, topic, lessonSpecPoint } from '$lib/server/db/schema';
import { eq, asc, and, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const moduleId = params.id;

	// Get module details with exam specification
	const modules = await db
		.select({
			id: module.id,
			name: module.name,
			description: module.description,
			targetSpecId: module.targetSpecId,
			createdAt: module.createdAt,
			updatedAt: module.updatedAt,
			targetSpec: {
				id: examSpec.id,
				board: examSpec.board,
				level: examSpec.level,
				name: examSpec.name,
				specCode: examSpec.specCode,
				specYear: examSpec.specYear
			}
		})
		.from(module)
		.leftJoin(examSpec, eq(module.targetSpecId, examSpec.id))
		.where(eq(module.id, moduleId));

	if (modules.length === 0) {
		throw error(404, 'Module not found');
	}

	const moduleData = modules[0];

	// Get lessons for this module
	const lessons = await db
		.select()
		.from(lesson)
		.where(eq(lesson.moduleId, moduleId))
		.orderBy(asc(lesson.order));

	// Get spec point links for all lessons
	const lessonIds = lessons.map((l) => l.id);
	let lessonSpecLinks: Array<{
		lessonId: string;
		specPointId: string;
		reference: string;
		content: string;
	}> = [];

	if (lessonIds.length > 0) {
		lessonSpecLinks = await db
			.select({
				lessonId: lessonSpecPoint.lessonId,
				specPointId: lessonSpecPoint.specPointId,
				reference: specPoint.reference,
				content: specPoint.content
			})
			.from(lessonSpecPoint)
			.innerJoin(specPoint, eq(lessonSpecPoint.specPointId, specPoint.id))
			.where(inArray(lessonSpecPoint.lessonId, lessonIds))
			.orderBy(asc(specPoint.sortOrder));
	}

	// Build lesson data with spec points
	const lessonsWithSpecPoints = lessons.map((l) => ({
		...l,
		specPoints: lessonSpecLinks
			.filter((link) => link.lessonId === l.id)
			.map((link) => ({
				id: link.specPointId,
				reference: link.reference,
				content: link.content
			}))
	}));

	// Get all available exam specifications for the form
	const examSpecs = await db
		.select()
		.from(examSpec)
		.orderBy(asc(examSpec.level), asc(examSpec.board));

	// Get all spec points for the module's target spec (if it has one)
	let specPoints: Array<{ id: string; reference: string; content: string }> = [];

	if (moduleData.targetSpecId) {
		specPoints = await db
			.select({
				id: specPoint.id,
				reference: specPoint.reference,
				content: specPoint.content
			})
			.from(specPoint)
			.innerJoin(topic, eq(specPoint.topicId, topic.id))
			.where(eq(topic.examSpecId, moduleData.targetSpecId))
			.orderBy(asc(specPoint.sortOrder));
	}

	return {
		module: moduleData,
		lessons: lessonsWithSpecPoints,
		examSpecs,
		specPoints
	};
};

export const actions: Actions = {
	updateModule: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const description = data.get('description')?.toString();
		const targetSpecId = data.get('targetSpecId')?.toString();

		// Validation
		if (!name.trim()) {
			return { error: 'Module name is required' };
		}

		// Update module
		await db
			.update(module)
			.set({
				name: name.trim(),
				description: description && description.trim() ? description.trim() : null,
				targetSpecId: targetSpecId && targetSpecId.trim() ? targetSpecId.trim() : null,
				updatedAt: new Date()
			})
			.where(eq(module.id, params.id));

		return { success: true };
	},

	addLesson: async ({ request, params }) => {
		const data = await request.formData();
		const title = data.get('title')?.toString() || '';
		const content = data.get('content')?.toString();
		const durationStr = data.get('duration')?.toString();
		const duration = durationStr ? parseInt(durationStr, 10) : 1;

		// Validation
		if (!title.trim()) {
			return { error: 'Lesson title is required' };
		}

		// Get next order number
		const existingLessons = await db
			.select({ order: lesson.order })
			.from(lesson)
			.where(eq(lesson.moduleId, params.id))
			.orderBy(asc(lesson.order));

		const nextOrder =
			existingLessons.length > 0 ? Math.max(...existingLessons.map((l) => l.order)) + 1 : 1;

		// Insert new lesson
		await db.insert(lesson).values({
			moduleId: params.id,
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

		// Validation
		if (!title.trim()) {
			return { error: 'Lesson title is required' };
		}

		// Update lesson
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

	deleteLesson: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString();

		if (!lessonId) {
			return { error: 'Lesson ID is required' };
		}

		// Get the lesson to find its order and moduleId
		const lessonToDelete = await db.select().from(lesson).where(eq(lesson.id, lessonId));

		if (lessonToDelete.length === 0) {
			return { error: 'Lesson not found' };
		}

		const deletedOrder = lessonToDelete[0].order;
		const moduleId = lessonToDelete[0].moduleId;

		// Delete the lesson (spec point links will cascade)
		await db.delete(lesson).where(eq(lesson.id, lessonId));

		// Reorder remaining lessons
		const remainingLessons = await db
			.select()
			.from(lesson)
			.where(eq(lesson.moduleId, moduleId))
			.orderBy(asc(lesson.order));

		// Update order for lessons after the deleted one
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

		// Validate all lessons belong to this module
		const existingLessons = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(eq(lesson.moduleId, params.id));

		const existingIds = new Set(existingLessons.map((l) => l.id));
		const allValid = lessonIds.every((id) => existingIds.has(id));

		if (!allValid || lessonIds.length !== existingIds.size) {
			return { error: 'Invalid lesson IDs' };
		}

		// Update order for each lesson
		for (let i = 0; i < lessonIds.length; i++) {
			await db
				.update(lesson)
				.set({ order: i + 1 })
				.where(eq(lesson.id, lessonIds[i]));
		}

		return { success: true };
	},

	linkSpecPoint: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString();
		const specPointId = data.get('specPointId')?.toString();

		if (!lessonId || !specPointId) {
			return { error: 'Lesson ID and Spec Point ID are required' };
		}

		// Check if link already exists
		const existingLinks = await db
			.select()
			.from(lessonSpecPoint)
			.where(
				and(eq(lessonSpecPoint.lessonId, lessonId), eq(lessonSpecPoint.specPointId, specPointId))
			);

		if (existingLinks.length === 0) {
			// Create the link
			await db.insert(lessonSpecPoint).values({
				lessonId,
				specPointId
			});
		}

		return { success: true };
	},

	unlinkSpecPoint: async ({ request }) => {
		const data = await request.formData();
		const lessonId = data.get('lessonId')?.toString();
		const specPointId = data.get('specPointId')?.toString();

		if (!lessonId || !specPointId) {
			return { error: 'Lesson ID and Spec Point ID are required' };
		}

		// Delete the link
		await db
			.delete(lessonSpecPoint)
			.where(
				and(eq(lessonSpecPoint.lessonId, lessonId), eq(lessonSpecPoint.specPointId, specPointId))
			);

		return { success: true };
	}
};
