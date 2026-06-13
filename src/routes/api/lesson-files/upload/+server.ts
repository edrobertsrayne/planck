import { json, error } from '@sveltejs/kit';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireUserId } from '$lib/server/session';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson } from '$lib/server/db/schema';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from '$lib/lesson-content/files';

async function userOwnsTarget(userId: string, ownerType: string, ownerId: number): Promise<boolean> {
	if (ownerType === 'lesson') {
		const [row] = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(and(eq(lesson.userId, userId), eq(lesson.id, ownerId)));
		return !!row;
	}
	if (ownerType === 'scheduled') {
		const [row] = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, ownerId)));
		return !!row;
	}
	return false;
}

export const POST: RequestHandler = async (event) => {
	const userId = requireUserId(event);
	const body = (await event.request.json()) as HandleUploadBody;

	const result = await handleUpload({
		body,
		request: event.request,
		onBeforeGenerateToken: async (_pathname, clientPayload) => {
			let payload: { ownerType?: string; ownerId?: number } = {};
			try {
				payload = JSON.parse(clientPayload ?? '{}');
			} catch {
				throw error(400, 'Invalid client payload');
			}
			if (!payload.ownerType || !payload.ownerId) throw error(400, 'Missing owner');
			const owns = await userOwnsTarget(userId, payload.ownerType, payload.ownerId);
			if (!owns) throw error(403, 'Not your lesson');
			return {
				allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
				maximumSizeInBytes: MAX_FILE_BYTES,
				addRandomSuffix: true
			};
		},
		// Not used (no public webhook on localhost); the client records the row via a form action.
		onUploadCompleted: async () => {}
	});

	return json(result);
};
