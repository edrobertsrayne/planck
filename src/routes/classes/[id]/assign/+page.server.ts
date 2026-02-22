import { db } from '$lib/server/db';
import { teachingClass, module, course } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { assignModuleToClass } from '$lib/server/scheduling/assign-module';

export const load: PageServerLoad = async ({ params }) => {
	const classId = params.id;

	// Get class details
	const classes = await db
		.select({
			id: teachingClass.id,
			name: teachingClass.name,
			yearGroup: teachingClass.yearGroup,
			courseId: teachingClass.courseId
		})
		.from(teachingClass)
		.where(eq(teachingClass.id, classId));

	if (classes.length === 0) {
		throw error(404, 'Class not found');
	}

	const classData = classes[0];

	// Get all available modules with course info
	const modules = await db
		.select({
			id: module.id,
			name: module.name,
			courseId: module.courseId,
			course: {
				id: course.id,
				name: course.name
			}
		})
		.from(module)
		.innerJoin(course, eq(module.courseId, course.id))
		.orderBy(asc(course.name), asc(module.name));

	return {
		class: classData,
		modules: modules.map((m) => ({
			id: m.id,
			name: m.name,
			courseId: m.courseId,
			courseName: m.course.name
		}))
	};
};

export const actions: Actions = {
	assign: async ({ request, params }) => {
		const classId = params.id;
		const data = await request.formData();
		const moduleId = data.get('moduleId')?.toString() || '';
		const startDateStr = data.get('startDate')?.toString();
		const useNextAvailable = data.get('useNextAvailable') === 'true';

		if (!moduleId.trim()) {
			return { error: 'Module selection is required' };
		}

		let startDate: Date | undefined;
		if (!useNextAvailable) {
			if (!startDateStr || !startDateStr.trim()) {
				return { error: 'Start date is required when not using next available slot' };
			}

			startDate = new Date(startDateStr);
			if (isNaN(startDate.getTime())) {
				return { error: 'Invalid start date' };
			}

			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);
			if (startDate < today) {
				return { error: 'Start date cannot be in the past' };
			}
		}

		try {
			await assignModuleToClass({
				classId,
				moduleId,
				startDate
			});

			throw redirect(303, `/classes/${classId}`);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to assign module';
			return { error: errorMessage };
		}
	}
};
