import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getModule,
	listLessons,
	createLesson,
	renameLesson,
	deleteLesson,
	reorderLessons
} from '$lib/server/queries/courses';
import { listClasses } from '$lib/server/queries/classes';
import { assignModule } from '$lib/server/queries/schedule';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const moduleId = Number(event.params.moduleId);
	const mod = await getModule(userId, moduleId);
	if (!mod) throw error(404, 'Module not found');
	const allClasses = await listClasses(userId);
	return {
		module: mod,
		lessons: await listLessons(userId, moduleId),
		classes: allClasses.filter((c) => c.courseId === mod.courseId)
	};
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await createLesson(userId, Number(event.params.moduleId), String(form.get('title')).trim());
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await renameLesson(userId, Number(form.get('id')), String(form.get('title')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteLesson(userId, Number(form.get('id')));
	},
	reorder: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await reorderLessons(userId, String(form.get('orderedIds')).split(',').map(Number));
	},
	assign: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const classId = Number(form.get('classId'));
		try {
			const result = await assignModule(userId, Number(event.params.moduleId), classId);
			return { assigned: result };
		} catch (e) {
			return fail(400, { assignError: (e as Error).message });
		}
	}
};
