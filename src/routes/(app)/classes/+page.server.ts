import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { listClasses, createClass, updateClass, deleteClass } from '$lib/server/queries/classes';
import { listCourses } from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [classes, courses] = await Promise.all([listClasses(userId), listCourses(userId)]);
	return { classes, courses };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const name = String(form.get('name')).trim();
		const courseId = Number(form.get('courseId'));
		if (!name || !courseId) throw error(400, 'Name and course required');
		await createClass(userId, name, courseId);
	},
	update: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateClass(userId, Number(form.get('id')), String(form.get('name')), Number(form.get('courseId')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteClass(userId, Number(form.get('id')));
	}
};
