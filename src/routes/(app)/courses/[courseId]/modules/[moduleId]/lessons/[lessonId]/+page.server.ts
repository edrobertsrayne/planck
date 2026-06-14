import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getLesson } from '$lib/server/queries/courses';
import {
	saveLessonPlan,
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile
} from '$lib/server/queries/lesson-content';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const lessonId = Number(event.params.lessonId);
	const lesson = await getLesson(userId, lessonId);
	if (!lesson) throw error(404, 'Lesson not found');
	return {
		lesson,
		links: await listLinks(userId, { lessonId }),
		files: await listFiles(userId, { lessonId })
	};
};

export const actions: Actions = {
	savePlan: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await saveLessonPlan(
			userId,
			{ lessonId: Number(event.params.lessonId) },
			String(form.get('plan'))
		);
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ lessonId: Number(event.params.lessonId) },
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
			{ lessonId: Number(event.params.lessonId) },
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
