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
	blobUrl: string;
	pathname: string;
	filename: string;
	contentType: string;
	size: number;
	orderIndex: number;
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
 * Duplicate a template lesson's files onto a scheduled lesson. Blobs are NOT
 * copied — each new row reuses the source blobUrl/pathname, so one blob is
 * shared by reference and reclaimed only when the last row referencing it goes.
 */
export function buildCopiedFileRows(
	files: TemplateFile[],
	userId: string,
	scheduledLessonId: number
): NewFileRow[] {
	return files.map((f) => ({
		userId,
		lessonId: null,
		scheduledLessonId,
		blobUrl: f.blobUrl,
		pathname: f.pathname,
		filename: f.filename,
		contentType: f.contentType,
		size: f.size,
		orderIndex: f.orderIndex
	}));
}
