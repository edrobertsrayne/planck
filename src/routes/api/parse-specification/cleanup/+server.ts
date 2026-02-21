import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanupSession } from '$lib/server/parse-temp-storage';

/**
 * DELETE /api/parse-specification/cleanup
 * Clean up temporary files for a parse session
 * Idempotent - always succeeds even if session doesn't exist
 */
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { uploadId } = body;

		// Always succeed - cleanup is best-effort
		if (uploadId) {
			try {
				await cleanupSession(uploadId);
			} catch (err) {
				console.error('Cleanup error:', err);
				// Don't fail - cleanup is best-effort
			}
		}

		return json({ success: true });
	} catch (err) {
		// Even if JSON parsing fails, return success
		console.error('Cleanup request error:', err);
		return json({ success: true });
	}
};
