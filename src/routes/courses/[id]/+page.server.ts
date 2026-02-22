import { db } from '$lib/server/db';
import { course, module, lesson } from '$lib/server/db/schema';
import { eq, asc, count } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const courseId = params.id;

	const courses = await db.select().from(course).where(eq(course.id, courseId));

	if (courses.length === 0) {
		throw error(404, 'Course not found');
	}

	const courseData = courses[0];

	// Get modules with lesson counts
	const modules = await db
		.select({
			id: module.id,
			name: module.name,
			notes: module.notes,
			createdAt: module.createdAt,
			updatedAt: module.updatedAt
		})
		.from(module)
		.where(eq(module.courseId, courseId))
		.orderBy(asc(module.name));

	const lessonCounts = await db
		.select({
			moduleId: lesson.moduleId,
			count: count()
		})
		.from(lesson)
		.groupBy(lesson.moduleId);

	const lessonCountMap = new Map(lessonCounts.map((lc) => [lc.moduleId, lc.count]));

	const modulesWithCounts = modules.map((m) => ({
		...m,
		lessonCount: lessonCountMap.get(m.id) ?? 0
	}));

	return {
		course: courseData,
		modules: modulesWithCounts
	};
};

export const actions: Actions = {
	updateCourse: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const notes = data.get('notes')?.toString();

		if (!name.trim()) {
			return { error: 'Course name is required' };
		}

		await db
			.update(course)
			.set({
				name: name.trim(),
				notes: notes && notes.trim() ? notes.trim() : null,
				updatedAt: new Date()
			})
			.where(eq(course.id, params.id));

		return { success: true };
	},

	createModule: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';

		if (!name.trim()) {
			return { error: 'Module name is required' };
		}

		await db.insert(module).values({
			name: name.trim(),
			courseId: params.id
		});

		return { success: true };
	},

	deleteCourse: async ({ params }) => {
		await db.delete(course).where(eq(course.id, params.id));
		throw redirect(303, '/courses');
	}
};
