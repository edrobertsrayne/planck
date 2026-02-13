import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createFileAttachment,
	createLinkAttachment,
	getAttachments,
	deleteAttachment,
	type AttachmentEntityType
} from '$lib/server/attachments';

/**
 * GET /api/attachments?entityType=...&entityId=...
 * Retrieve all attachments for an entity
 */
export const GET: RequestHandler = async ({ url }) => {
	const entityType = url.searchParams.get('entityType') as AttachmentEntityType;
	const entityId = url.searchParams.get('entityId');

	if (!entityType || !entityId) {
		throw error(400, 'Missing entityType or entityId parameter');
	}

	const attachments = await getAttachments(entityType, entityId);
	return json(attachments);
};

/**
 * POST /api/attachments
 * Create a new attachment (file or link)
 */
export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const entityType = formData.get('entityType') as AttachmentEntityType;
	const entityId = formData.get('entityId') as string;
	const type = formData.get('type') as 'file' | 'link';

	if (!entityType || !entityId || !type) {
		throw error(400, 'Missing required fields: entityType, entityId, type');
	}

	if (type === 'file') {
		const file = formData.get('file') as File;
		if (!file) {
			throw error(400, 'Missing file');
		}

		try {
			const attachment = await createFileAttachment(entityType, entityId, file);
			return json(attachment, { status: 201 });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			throw error(500, message);
		}
	} else if (type === 'link') {
		const url = formData.get('url') as string;
		const title = formData.get('title') as string;

		if (!url || !title) {
			throw error(400, 'Missing url or title for link attachment');
		}

		try {
			const attachment = await createLinkAttachment(entityType, entityId, url, title);
			return json(attachment, { status: 201 });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			throw error(500, message);
		}
	} else {
		throw error(400, 'Invalid attachment type. Must be "file" or "link"');
	}
};

/**
 * DELETE /api/attachments/:id
 * Delete an attachment
 */
export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');

	if (!id) {
		throw error(400, 'Missing attachment id parameter');
	}

	try {
		await deleteAttachment(id);
		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, message);
	}
};
