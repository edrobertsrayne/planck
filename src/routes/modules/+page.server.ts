import { db } from '$lib/server/db';
import { module, examSpec, lesson, moduleAssignment } from '$lib/server/db/schema';
import { asc, eq, count } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Get all modules with their exam specifications and counts
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
		.orderBy(asc(module.name));

	// Count lessons for each module
	const lessonCounts = await db
		.select({
			moduleId: lesson.moduleId,
			count: count()
		})
		.from(lesson)
		.groupBy(lesson.moduleId);

	// Count assignments for each module
	const assignmentCounts = await db
		.select({
			moduleId: moduleAssignment.moduleId,
			count: count()
		})
		.from(moduleAssignment)
		.groupBy(moduleAssignment.moduleId);

	// Create lookup maps for counts
	const lessonCountMap = new Map(lessonCounts.map((lc) => [lc.moduleId, lc.count]));
	const assignmentCountMap = new Map(assignmentCounts.map((ac) => [ac.moduleId, ac.count]));

	// Combine module data with counts
	const modulesWithCounts = modules.map((m) => ({
		...m,
		lessonCount: lessonCountMap.get(m.id) ?? 0,
		assignmentCount: assignmentCountMap.get(m.id) ?? 0
	}));

	// Get all available exam specifications for the create form
	const examSpecs = await db
		.select()
		.from(examSpec)
		.orderBy(asc(examSpec.level), asc(examSpec.board));

	return {
		modules: modulesWithCounts,
		examSpecs
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name')?.toString() || '';
		const description = data.get('description')?.toString();
		const targetSpecId = data.get('targetSpecId')?.toString();

		// Validation
		if (!name.trim()) {
			return { error: 'Module name is required' };
		}

		// Insert new module
		await db.insert(module).values({
			name: name.trim(),
			description: description && description.trim() ? description.trim() : null,
			targetSpecId: targetSpecId && targetSpecId.trim() ? targetSpecId.trim() : null
		});

		return { success: true };
	}
};
