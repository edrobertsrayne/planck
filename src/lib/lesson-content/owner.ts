/** Which lesson a link/file is attached to. Exactly one variant is ever set. */
export type OwnerRef = { lessonId: number } | { scheduledLessonId: number };

export interface OwnerColumns {
	lessonId: number | null;
	scheduledLessonId: number | null;
}

/**
 * Map an owner reference to the (lessonId, scheduledLessonId) column pair for an
 * insert. Throws unless exactly one side is set — this is the invariant that
 * keeps every lesson_link / lesson_file row attached to a single owner.
 */
export function ownerColumns(owner: OwnerRef): OwnerColumns {
	const lessonId = 'lessonId' in owner && owner.lessonId != null ? owner.lessonId : null;
	const scheduledLessonId =
		'scheduledLessonId' in owner && owner.scheduledLessonId != null
			? owner.scheduledLessonId
			: null;
	const exactlyOne = (lessonId === null) !== (scheduledLessonId === null);
	if (!exactlyOne) {
		throw new Error('ownerColumns: exactly one of lessonId / scheduledLessonId is required');
	}
	return { lessonId, scheduledLessonId };
}
