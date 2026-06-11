import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	getConfig,
	upsertConfig,
	getBlocks,
	addBlock,
	deleteBlock,
	getClosures,
	addClosure,
	deleteClosure
} from '$lib/server/queries/timetable';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [config, blocks, closures] = await Promise.all([
		getConfig(userId),
		getBlocks(userId),
		getClosures(userId)
	]);
	return { config, blocks, closures };
};

export const actions: Actions = {
	saveConfig: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const teachingDays = form
			.getAll('teachingDays')
			.map((d) => Number(d))
			.filter((n) => n >= 1 && n <= 5);
		await upsertConfig(userId, {
			cycleWeeks: Number(form.get('cycleWeeks')),
			teachingDays,
			periodsPerDay: Number(form.get('periodsPerDay')),
			anchorLetter: String(form.get('anchorLetter'))
		});
	},
	addBlock: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addBlock(
			userId,
			String(form.get('name')),
			String(form.get('startDate')),
			String(form.get('endDate'))
		);
	},
	deleteBlock: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteBlock(userId, Number(form.get('id')));
	},
	addClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addClosure(userId, String(form.get('date')));
	},
	deleteClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteClosure(userId, Number(form.get('id')));
	}
};
