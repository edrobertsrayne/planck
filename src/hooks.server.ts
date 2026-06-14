import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { fetchSession } from '$lib/server/neon-auth';

const SESSION_PATH = '/get-session';

export const handle: Handle = async ({ event, resolve }) => {
	const baseUrl = env.NEON_AUTH_URL;
	if (baseUrl) {
		const cookie = event.request.headers.get('cookie') ?? '';
		const result = await fetchSession(fetch, baseUrl, SESSION_PATH, cookie);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		}
	}
	return resolve(event);
};
