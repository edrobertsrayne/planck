import { db } from '$lib/server/db';
import { course, module, lesson } from '$lib/server/db/schema';
import { asc, eq, count } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const courses = await db.select().from(course).orderBy(asc(course.name));

	// Count modules for each course
	const moduleCounts = await db
		.select({
			courseId: module.courseId,
			count: count()
		})
		.from(module)
		.groupBy(module.courseId);

	const moduleCountMap = new Map(moduleCounts.map((mc) => [mc.courseId, mc.count]));

	// Count lessons for each course (via modules)
	const lessonCounts = await db
		.select({
			courseId: module.courseId,
			count: count()
		})
		.from(lesson)
		.innerJoin(module, eq(lesson.moduleId, module.id))
		.groupBy(module.courseId);

	const lessonCountMap = new Map(lessonCounts.map((lc) => [lc.courseId, lc.count]));

	const coursesWithCounts = courses.map((c) => ({
		...c,
		moduleCount: moduleCountMap.get(c.id) ?? 0,
		lessonCount: lessonCountMap.get(c.id) ?? 0
	}));

	return { courses: coursesWithCounts };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';

		if (!name.trim()) {
			return { error: 'Course name is required' };
		}

		await db.insert(course).values({
			name: name.trim()
		});

		return { success: true };
	}
};
