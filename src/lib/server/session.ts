import { error } from '@sveltejs/kit';

export function requireUserId(event: { locals: App.Locals }): string {
	if (!event.locals.user) throw error(401, 'Not signed in');
	return event.locals.user.id;
}
