import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getScheduledLesson } from '$lib/server/queries/schedule';
import { saveLessonPlan } from '$lib/server/queries/lesson-content';
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
	const scheduledLessonId = Number(event.params.scheduledLessonId);
	const lesson = await getScheduledLesson(userId, scheduledLessonId);
	if (!lesson) throw error(404, 'Lesson not found');
	return {
		lesson,
		links: await listLinks(userId, { scheduledLessonId }),
		files: await listFiles(userId, { scheduledLessonId })
	};
};

export const actions: Actions = {
	savePlan: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await saveLessonPlan(
			userId,
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
			String(form.get('plan'))
		);
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
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
			{ scheduledLessonId: Number(event.params.scheduledLessonId) },
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
