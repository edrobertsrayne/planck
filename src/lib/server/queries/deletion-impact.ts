import { eq, and, inArray, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { klass, module, lesson, scheduledLesson, resourceFile } from '$lib/server/db/schema';

/** Count this user's resource_file rows where `column` is in `ids`. */
async function countFilesIn(userId: string, column: AnyPgColumn, ids: number[]): Promise<number> {
	if (ids.length === 0) return 0;
	const [row] = await db
		.select({ n: sql<number>`count(*)` })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), inArray(column, ids)));
	return Number(row?.n ?? 0);
}

export async function moduleDeletionImpact(
	userId: string,
	id: number
): Promise<{ lessons: number; files: number }> {
	const lessons = await db
		.select({ id: lesson.id })
		.from(lesson)
		.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, id)));
	const files =
		(await countFilesIn(userId, resourceFile.moduleId, [id])) +
		(await countFilesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((l) => l.id)
		));
	return { lessons: lessons.length, files };
}

export async function classDeletionImpact(
	userId: string,
	id: number
): Promise<{ scheduledLessons: number; files: number }> {
	const scheduled = await db
		.select({ id: scheduledLesson.id })
		.from(scheduledLesson)
		.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, id)));
	const files = await countFilesIn(
		userId,
		resourceFile.scheduledLessonId,
		scheduled.map((s) => s.id)
	);
	return { scheduledLessons: scheduled.length, files };
}

export async function courseDeletionImpact(
	userId: string,
	id: number
): Promise<{ classes: number; scheduledLessons: number; files: number }> {
	const modules = await db
		.select({ id: module.id })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, id)));
	const moduleIds = modules.map((m) => m.id);
	const lessons =
		moduleIds.length === 0
			? []
			: await db
					.select({ id: lesson.id })
					.from(lesson)
					.where(and(eq(lesson.userId, userId), inArray(lesson.moduleId, moduleIds)));
	const classes = await db
		.select({ id: klass.id })
		.from(klass)
		.where(and(eq(klass.userId, userId), eq(klass.courseId, id)));
	const classIds = classes.map((c) => c.id);
	const scheduled =
		classIds.length === 0
			? []
			: await db
					.select({ id: scheduledLesson.id })
					.from(scheduledLesson)
					.where(
						and(eq(scheduledLesson.userId, userId), inArray(scheduledLesson.classId, classIds))
					);
	const files =
		(await countFilesIn(userId, resourceFile.courseId, [id])) +
		(await countFilesIn(userId, resourceFile.moduleId, moduleIds)) +
		(await countFilesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((l) => l.id)
		)) +
		(await countFilesIn(
			userId,
			resourceFile.scheduledLessonId,
			scheduled.map((s) => s.id)
		));
	return { classes: classes.length, scheduledLessons: scheduled.length, files };
}
