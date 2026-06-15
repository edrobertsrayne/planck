import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson } from '$lib/server/db/schema';
import { type OwnerRef } from '$lib/resources/owner';

/** Save the free-text plan for a template lesson or a scheduled lesson. */
export function saveLessonPlan(userId: string, owner: OwnerRef, plan: string) {
	if ('lessonId' in owner) {
		return db
			.update(lesson)
			.set({ plan })
			.where(and(eq(lesson.userId, userId), eq(lesson.id, owner.lessonId)));
	}
	if ('scheduledLessonId' in owner) {
		return db
			.update(scheduledLesson)
			.set({ plan })
			.where(
				and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, owner.scheduledLessonId))
			);
	}
	throw new Error('saveLessonPlan: owner must be a lesson or scheduled lesson');
}
