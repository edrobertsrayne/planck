/** Which entity a link/file is attached to. Exactly one variant is ever set. */
export type OwnerRef =
	| { lessonId: number }
	| { scheduledLessonId: number }
	| { courseId: number }
	| { moduleId: number };

export interface OwnerColumns {
	lessonId: number | null;
	scheduledLessonId: number | null;
	courseId: number | null;
	moduleId: number | null;
}

/**
 * Map an owner reference to the FK column set for an insert. Throws unless
 * exactly one side is set — the invariant that keeps every resource_link /
 * resource_file row attached to a single owner.
 */
export function ownerColumns(owner: OwnerRef): OwnerColumns {
	const cols: OwnerColumns = {
		lessonId: 'lessonId' in owner && owner.lessonId != null ? owner.lessonId : null,
		scheduledLessonId:
			'scheduledLessonId' in owner && owner.scheduledLessonId != null
				? owner.scheduledLessonId
				: null,
		courseId: 'courseId' in owner && owner.courseId != null ? owner.courseId : null,
		moduleId: 'moduleId' in owner && owner.moduleId != null ? owner.moduleId : null
	};
	const setCount = [cols.lessonId, cols.scheduledLessonId, cols.courseId, cols.moduleId].filter(
		(v) => v !== null
	).length;
	if (setCount !== 1) {
		throw new Error(
			'ownerColumns: exactly one of lessonId / scheduledLessonId / courseId / moduleId is required'
		);
	}
	return cols;
}
