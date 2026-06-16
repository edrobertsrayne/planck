import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getCourse,
	listModules,
	createModule,
	renameModule,
	deleteModule,
	reorderModules,
	updateCourse
} from '$lib/server/queries/courses';
import {
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/resources';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const courseId = Number(event.params.courseId);
	const course = await getCourse(userId, courseId);
	if (!course) throw error(404, 'Course not found');
	return {
		course,
		modules: await listModules(userId, courseId),
		links: await listLinks(userId, { courseId }),
		files: await listFiles(userId, { courseId })
	};
};

export const actions: Actions = {
	save: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateCourse(
			userId,
			Number(event.params.courseId),
			String(form.get('name')),
			String(form.get('colour'))
		);
	},
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
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ courseId: Number(event.params.courseId) },
			String(form.get('url')),
			form.get('label') ? String(form.get('label')) : null
		);
	},
	deleteLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteLink(userId, Number(form.get('id')));
	},
	addFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addFile(
			userId,
			{ courseId: Number(event.params.courseId) },
			{
				blobUrl: String(form.get('blobUrl')),
				pathname: String(form.get('pathname')),
				filename: String(form.get('filename')),
				contentType: String(form.get('contentType')),
				size: Number(form.get('size'))
			}
		);
	},
	deleteFile: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFile(userId, Number(form.get('id')));
	}
};
