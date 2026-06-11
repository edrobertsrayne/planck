import type { Actions, PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { getConfig, getSlots, setSlot, clearSlot } from '$lib/server/queries/timetable';
import { listClasses } from '$lib/server/queries/classes';

export const load: PageServerLoad = async (event) => {
	const userId = requireUserId(event);
	const [config, slots, classes] = await Promise.all([
		getConfig(userId),
		getSlots(userId),
		listClasses(userId)
	]);
	return { config, slots, classes };
};

export const actions: Actions = {
	set: async (event) => {
		const userId = requireUserId(event);
		const form = await event.request.formData();
		const classId = Number(form.get('classId'));
		const weekLetter = String(form.get('weekLetter'));
		const dayOfWeek = Number(form.get('dayOfWeek'));
		const period = Number(form.get('period'));
		if (!classId) {
			await clearSlot(userId, weekLetter, dayOfWeek, period);
			return;
		}
		await setSlot(userId, {
			weekLetter,
			dayOfWeek,
			period,
			classId,
			room: String(form.get('room') ?? '')
		});
	}
};
