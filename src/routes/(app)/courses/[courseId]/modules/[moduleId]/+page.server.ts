import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getModule,
	listLessons,
	createLesson,
	renameLesson,
	deleteLesson,
	reorderLessons,
	updateModuleDescription,
	updateLessonNote
} from '$lib/server/queries/courses';
import { listClasses } from '$lib/server/queries/classes';
import { assignModule } from '$lib/server/queries/schedule';
import {
	listLinks,
	addLink,
	deleteLink,
	listFiles,
	addFile,
	deleteFile,
	lessonAttachmentCounts
} from '$lib/server/queries/resources';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const moduleId = Number(event.params.moduleId);
	const mod = await getModule(userId, moduleId);
	if (!mod) throw error(404, 'Module not found');
	const allClasses = await listClasses(userId);
	const lessons = await listLessons(userId, moduleId);
	const counts = await lessonAttachmentCounts(
		userId,
		lessons.map((l) => l.id)
	);
	const lessonsWithCounts = lessons.map((l) => ({ ...l, attachmentCount: counts[l.id] ?? 0 }));
	return {
		module: mod,
		lessons: lessonsWithCounts,
		classes: allClasses.filter((c) => c.courseId === mod.courseId),
		links: await listLinks(userId, { moduleId }),
		files: await listFiles(userId, { moduleId })
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
	},
	addLink: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addLink(
			userId,
			{ moduleId: Number(event.params.moduleId) },
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
			{ moduleId: Number(event.params.moduleId) },
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
	},
	saveDescription: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateModuleDescription(
			userId,
			Number(event.params.moduleId),
			String(form.get('description'))
		);
	},
	saveLessonNote: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await updateLessonNote(userId, Number(form.get('id')), String(form.get('note')));
	}
};
