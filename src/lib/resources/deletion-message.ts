export type DeletionType = 'course' | 'class' | 'module';

/** Blast-radius counts; only the fields relevant to `type` are populated. */
export interface DeletionImpact {
	classes?: number;
	scheduledLessons?: number;
	lessons?: number;
	files?: number;
}

/** "3 classes" / "1 class" — pluralizes with an explicit plural form. */
function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** A human sentence describing what deleting `type` will remove. Display-only. */
export function deletionMessage(type: DeletionType, impact: DeletionImpact): string {
	const files = count(impact.files ?? 0, 'file', 'files');
	if (type === 'course') {
		const classes = count(impact.classes ?? 0, 'class', 'classes');
		const lessons = count(impact.scheduledLessons ?? 0, 'scheduled lesson', 'scheduled lessons');
		return `This deletes this subject, its ${classes}, ${lessons} and ${files}. This cannot be undone.`;
	}
	if (type === 'class') {
		const lessons = count(impact.scheduledLessons ?? 0, 'scheduled lesson', 'scheduled lessons');
		return `This deletes this class, ${lessons} and ${files}. This cannot be undone.`;
	}
	const lessons = count(impact.lessons ?? 0, 'lesson', 'lessons');
	return `This deletes this module, its ${lessons} and ${files}. This cannot be undone.`;
}
