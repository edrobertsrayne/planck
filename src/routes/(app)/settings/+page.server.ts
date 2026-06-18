import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { daysInMonth } from '$lib/scheduling/dates';
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
import { reallocateAllClasses } from '$lib/server/queries/schedule';

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
			.filter((n) => n >= 1 && n <= 7);
		// `|| 9`/`|| 1` fall back to the defaults when a field is missing or
		// non-numeric (a crafted POST), so NaN never propagates into the DB.
		const startMonth = Math.min(12, Math.max(1, Number(form.get('academicYearStartMonth')) || 9));
		const startDay = Math.min(
			daysInMonth(startMonth),
			Math.max(1, Number(form.get('academicYearStartDay')) || 1)
		);
		await upsertConfig(userId, {
			cycleWeeks: Number(form.get('cycleWeeks')),
			teachingDays,
			periodsPerDay: Number(form.get('periodsPerDay')),
			anchorLetter: String(form.get('anchorLetter')),
			academicYearStartMonth: startMonth,
			academicYearStartDay: startDay
		});
		await reallocateAllClasses(userId);
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
		await reallocateAllClasses(userId);
	},
	deleteBlock: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteBlock(userId, Number(form.get('id')));
		await reallocateAllClasses(userId);
	},
	addClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await addClosure(userId, String(form.get('name') ?? ''), String(form.get('date')));
		await reallocateAllClasses(userId);
	},
	deleteClosure: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		await deleteClosure(userId, Number(form.get('id')));
		await reallocateAllClasses(userId);
	}
};
