import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getCourse,
	listModules,
	createModule,
	renameModule,
	deleteModule,
	reorderModules
} from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const courseId = Number(event.params.courseId);
	const course = await getCourse(userId, courseId);
	if (!course) throw error(404, 'Course not found');
	return { course, modules: await listModules(userId, courseId) };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await createModule(userId, Number(event.params.courseId), String(form.get('name')).trim());
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await renameModule(userId, Number(form.get('id')), String(form.get('name')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteModule(userId, Number(form.get('id')));
	},
	reorder: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const ids = String(form.get('orderedIds')).split(',').map(Number);
		await reorderModules(userId, ids);
	}
};
