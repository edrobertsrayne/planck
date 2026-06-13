export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_CONTENT_TYPES = [
	'application/pdf',
	'image/png',
	'image/jpeg',
	'image/gif',
	'image/webp',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.spreadsheet',
	'application/vnd.oasis.opendocument.presentation',
	'text/plain'
] as const;

export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateFile(input: { contentType: string; size: number }): ValidateResult {
	if (!ALLOWED_CONTENT_TYPES.includes(input.contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
		return { ok: false, error: `File type not allowed: ${input.contentType}` };
	}
	if (input.size > MAX_FILE_BYTES) {
		return { ok: false, error: `File exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit` };
	}
	return { ok: true };
}

/** Turn an ordered list of ids into {id, orderIndex} pairs for a reorder write. */
export function applyOrder(orderedIds: number[]): { id: number; orderIndex: number }[] {
	return orderedIds.map((id, orderIndex) => ({ id, orderIndex }));
}
