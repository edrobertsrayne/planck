import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAttachment, getFilePath } from '$lib/server/attachments';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * GET /api/attachments/:id
 * Serve a file attachment for download
 */
export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	const attachment = await getAttachment(id);

	if (!attachment) {
		throw error(404, 'Attachment not found');
	}

	// Only serve file attachments (links are just URLs)
	if (attachment.type !== 'file' || !attachment.filePath) {
		throw error(400, 'This attachment is not a file');
	}

	const filePath = getFilePath(attachment.filePath);

	if (!existsSync(filePath)) {
		throw error(404, 'File not found on disk');
	}

	const fileBuffer = await readFile(filePath);

	return new Response(fileBuffer, {
		headers: {
			'Content-Type': attachment.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
			'Content-Length': fileBuffer.length.toString()
		}
	});
};
