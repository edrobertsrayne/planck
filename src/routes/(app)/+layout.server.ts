import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireUserId } from '$lib/server/session';
import { listClasses } from '$lib/server/queries/classes';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(303, '/login');
	const userId = requireUserId(event);
	return {
		user: {
			id: event.locals.user.id,
			name: event.locals.user.name,
			email: event.locals.user.email
		},
		classes: await listClasses(userId)
	};
};
