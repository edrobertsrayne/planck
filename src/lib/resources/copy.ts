export interface TemplateLink {
	url: string;
	label: string | null;
	orderIndex: number;
}

export interface NewLinkRow {
	userId: string;
	lessonId: number | null;
	scheduledLessonId: number | null;
	url: string;
	label: string | null;
	orderIndex: number;
}

/** Duplicate a template lesson's links, repointed at a new scheduled lesson. */
export function buildCopiedLinkRows(
	links: TemplateLink[],
	userId: string,
	scheduledLessonId: number
): NewLinkRow[] {
	return links.map((l) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		url: l.url,
		label: l.label,
		orderIndex: l.orderIndex
	}));
}

export interface TemplateFile {
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
}

export interface CopiedBlob {
	blobUrl: string;
	pathname: string;
}

export interface NewFileRow {
	userId: string;
	lessonId: number | null;
	scheduledLessonId: number | null;
	blobUrl: string;
	pathname: string;
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
}

/**
 * Duplicate a template lesson's files. `copies[i]` is the already-copied blob
 * for `files[i]`; the two arrays are parallel and must be the same length.
 */
export function buildCopiedFileRows(
	files: TemplateFile[],
	copies: CopiedBlob[],
	userId: string,
	scheduledLessonId: number
): NewFileRow[] {
	if (files.length !== copies.length) {
		throw new Error('buildCopiedFileRows: files/copies length mismatch');
	}
	return files.map((f, i) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		blobUrl: copies[i].blobUrl,
		pathname: copies[i].pathname,
		filename: f.filename,
		contentType: f.contentType,
		size: f.size,
		orderIndex: f.orderIndex
	}));
}
