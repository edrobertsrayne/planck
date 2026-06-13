import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getClassWithCourse } from '$lib/server/queries/classes';
import {
	todayIso,
	listClassSequence,
	reorderSequence,
	insertBlank,
	deleteFromSequence,
	renameScheduledLesson,
	nextOrderIndex,
	getOrderIndex
} from '$lib/server/queries/schedule';
import { getConfig, getBlocks, getClosures } from '$lib/server/queries/timetable';
import { listTeachingDays } from '$lib/scheduling/teaching-days';
import { resolveWeekLetters, weekLetterForDate } from '$lib/scheduling/week-letter';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const classId = Number(event.params.classId);
	const cls = await getClassWithCourse(userId, classId);
	if (!cls) throw error(404, 'Class not found');

	const today = todayIso();
	const rows = await listClassSequence(userId, classId, today);

	const [config, blocks, closures] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId)
	]);
	const teaching = listTeachingDays(
		blocks.map((b) => ({ startDate: b.startDate, endDate: b.endDate })),
		closures.map((c) => c.date),
		config.teachingDays
	);
	const weekMap = resolveWeekLetters(config.cycleWeeks, config.anchorLetter, teaching);

	const items = rows.map((r) => ({
		...r,
		weekLetter: r.date ? weekLetterForDate(r.date, weekMap) : null
	}));

	return { klass: cls, items };
};

export const actions: Actions = {
	reorder: async (event) => {
		const userId = requireUserId(event);
		const classId = Number(event.params.classId);
		const form = await event.request.formData();
		const orderedIds = String(form.get('orderedIds'))
			.split(',')
			.map(Number)
			.filter((n) => Number.isFinite(n));
		await reorderSequence(userId, classId, orderedIds);
	},
	insertBlank: async (event) => {
		const userId = requireUserId(event);
		const classId = Number(event.params.classId);
		const form = await event.request.formData();
		const beforeIdRaw = form.get('beforeId');
		const title = String(form.get('title') ?? 'New lesson').trim() || 'New lesson';
		const at =
			beforeIdRaw != null && String(beforeIdRaw) !== ''
				? await getOrderIndex(userId, Number(beforeIdRaw))
				: await nextOrderIndex(userId, classId);
		if (at === null) return;
		await insertBlank(userId, classId, at, title);
	},
	delete: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteFromSequence(userId, Number(form.get('id')));
	},
	rename: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const title = String(form.get('title')).trim();
		if (!title) return; // ignore empty titles rather than blanking the lesson label
		await renameScheduledLesson(userId, Number(form.get('id')), title);
	}
};
