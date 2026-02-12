import { db } from '$lib/server/db';
import { teachingClass, module, examSpec } from '$lib/server/db/schema';
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
			examSpecId: teachingClass.examSpecId
		})
		.from(teachingClass)
		.where(eq(teachingClass.id, classId));

	if (classes.length === 0) {
		throw error(404, 'Class not found');
	}

	const classData = classes[0];

	// Get all available modules
	const modules = await db
		.select({
			id: module.id,
			name: module.name,
			description: module.description,
			targetSpecId: module.targetSpecId,
			targetSpec: {
				id: examSpec.id,
				board: examSpec.board,
				level: examSpec.level,
				name: examSpec.name
			}
		})
		.from(module)
		.leftJoin(examSpec, eq(module.targetSpecId, examSpec.id))
		.orderBy(asc(module.name));

	return {
		class: classData,
		modules: modules.map((m) => ({
			id: m.id,
			name: m.name,
			description: m.description,
			targetSpecId: m.targetSpecId,
			targetSpec: m.targetSpec
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

		// Validation
		if (!moduleId.trim()) {
			return { error: 'Module selection is required' };
		}

		// Determine start date
		let startDate: Date | undefined;
		if (!useNextAvailable) {
			if (!startDateStr || !startDateStr.trim()) {
				return { error: 'Start date is required when not using next available slot' };
			}

			startDate = new Date(startDateStr);
			if (isNaN(startDate.getTime())) {
				return { error: 'Invalid start date' };
			}

			// Ensure the date is in the future or today
			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);
			if (startDate < today) {
				return { error: 'Start date cannot be in the past' };
			}
		}

		// Assign the module
		try {
			await assignModuleToClass({
				classId,
				moduleId,
				startDate
			});

			// Redirect to class detail page
			throw redirect(303, `/classes/${classId}`);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to assign module';
			return { error: errorMessage };
		}
	}
};
