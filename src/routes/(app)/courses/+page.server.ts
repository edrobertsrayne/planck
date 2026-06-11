import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	listCourses,
	createCourse,
	updateCourse,
	deleteCourse
} from '$lib/server/queries/courses';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	return { courses: await listCourses(userId) };
};

export const actions: Actions = {
	create: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const name = String(form.get('name')).trim();
		if (!name) throw error(400, 'Name required');
		await createCourse(userId, name, String(form.get('colour') || '#3884ff'));
	},
	update: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateCourse(userId, Number(form.get('id')), String(form.get('name')), String(form.get('colour')));
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteCourse(userId, Number(form.get('id')));
	}
};
