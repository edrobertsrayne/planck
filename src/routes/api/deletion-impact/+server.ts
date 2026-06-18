import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserId } from '$lib/server/session';
import {
	courseDeletionImpact,
	classDeletionImpact,
	moduleDeletionImpact
} from '$lib/server/queries/deletion-impact';

export const GET: RequestHandler = async (event) => {
	const userId = requireUserId(event);
	const type = event.url.searchParams.get('type');
	const id = Number(event.url.searchParams.get('id'));
	if (!Number.isInteger(id) || id <= 0) throw error(400, 'Invalid id');

	if (type === 'course') return json(await courseDeletionImpact(userId, id));
	if (type === 'class') return json(await classDeletionImpact(userId, id));
	if (type === 'module') return json(await moduleDeletionImpact(userId, id));
	throw error(400, 'Invalid type');
};
