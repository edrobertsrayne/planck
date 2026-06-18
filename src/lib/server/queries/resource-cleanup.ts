import { eq, and, inArray } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { resourceFile, module, lesson, klass, scheduledLesson } from '$lib/server/db/schema';
import { deleteBlobs } from '$lib/server/blob';
import { pathnamesToReclaim } from '$lib/resources/reclaim';

/** A node whose deletion cascade may remove resource_file rows. */
export type CascadeRoot =
	| { type: 'lesson'; id: number }
	| { type: 'module'; id: number }
	| { type: 'course'; id: number }
	| { type: 'class'; id: number }
	| { type: 'scheduledLessons'; ids: number[] };

/** Pathnames of this user's resource_file rows where `column` is in `ids`. */
async function filePathnamesIn(
	userId: string,
	column: AnyPgColumn,
	ids: number[]
): Promise<string[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.select({ pathname: resourceFile.pathname })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), inArray(column, ids)));
	return rows.map((r) => r.pathname);
}

/**
 * Every blob pathname that deleting `root` will orphan, by walking the same
 * FK cascade Postgres will. With lesson_id/module_id now `set null`, deleting a
 * module or lesson does NOT reach scheduled lessons — they detach and survive.
 */
export async function descendantFilePathnames(
	userId: string,
	root: CascadeRoot
): Promise<string[]> {
	const out = new Set<string>();
	const add = (paths: string[]) => paths.forEach((p) => out.add(p));

	if (root.type === 'scheduledLessons') {
		add(await filePathnamesIn(userId, resourceFile.scheduledLessonId, root.ids));
		return [...out];
	}
	if (root.type === 'lesson') {
		add(await filePathnamesIn(userId, resourceFile.lessonId, [root.id]));
		return [...out];
	}
	if (root.type === 'class') {
		const sl = await db
			.select({ id: scheduledLesson.id })
			.from(scheduledLesson)
			.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.classId, root.id)));
		add(
			await filePathnamesIn(
				userId,
				resourceFile.scheduledLessonId,
				sl.map((r) => r.id)
			)
		);
		return [...out];
	}
	if (root.type === 'module') {
		const lessons = await db
			.select({ id: lesson.id })
			.from(lesson)
			.where(and(eq(lesson.userId, userId), eq(lesson.moduleId, root.id)));
		add(await filePathnamesIn(userId, resourceFile.moduleId, [root.id]));
		add(
			await filePathnamesIn(
				userId,
				resourceFile.lessonId,
				lessons.map((r) => r.id)
			)
		);
		return [...out];
	}
	// course
	const modules = await db
		.select({ id: module.id })
		.from(module)
		.where(and(eq(module.userId, userId), eq(module.courseId, root.id)));
	const moduleIds = modules.map((r) => r.id);
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
		.where(and(eq(klass.userId, userId), eq(klass.courseId, root.id)));
	const classIds = classes.map((r) => r.id);
	const scheduled =
		classIds.length === 0
			? []
			: await db
					.select({ id: scheduledLesson.id })
					.from(scheduledLesson)
					.where(
						and(eq(scheduledLesson.userId, userId), inArray(scheduledLesson.classId, classIds))
					);
	add(await filePathnamesIn(userId, resourceFile.courseId, [root.id]));
	add(await filePathnamesIn(userId, resourceFile.moduleId, moduleIds));
	add(
		await filePathnamesIn(
			userId,
			resourceFile.lessonId,
			lessons.map((r) => r.id)
		)
	);
	add(
		await filePathnamesIn(
			userId,
			resourceFile.scheduledLessonId,
			scheduled.map((r) => r.id)
		)
	);
	return [...out];
}

/**
 * Delete the blobs among `candidatePathnames` that no resource_file row still
 * references. Call AFTER the rows are deleted. Failures are logged, never
 * thrown: the DB delete already succeeded, and a blob hiccup must not fail the
 * user's action (worst case is a leaked blob, the pre-existing behaviour).
 */
export async function reclaimBlobs(candidatePathnames: string[]): Promise<void> {
	const unique = [...new Set(candidatePathnames)];
	if (unique.length === 0) return;
	try {
		const CHUNK = 100;
		const stillReferenced: string[] = [];
		for (let i = 0; i < unique.length; i += CHUNK) {
			// Deliberately NOT user-scoped: a pathname is globally unique in blob
			// storage, so a blob must survive if ANY user's row still references it.
			// Adding a userId filter here would risk deleting a shared blob. A
			// concurrent insert between gather and delete is also safe — it shows up
			// in this re-query and spares the blob.
			const rows = await db
				.select({ pathname: resourceFile.pathname })
				.from(resourceFile)
				.where(inArray(resourceFile.pathname, unique.slice(i, i + CHUNK)));
			stillReferenced.push(...rows.map((r) => r.pathname));
		}
		await deleteBlobs(pathnamesToReclaim(unique, stillReferenced));
	} catch (err) {
		console.error('reclaimBlobs failed', err);
	}
}

/**
 * Gather the pathnames `root`'s deletion will orphan, run `deleteRows()` (the
 * cascade), then reclaim the now-unreferenced blobs. Ordering is the only
 * safety mechanism — neon-http has no transactions.
 */
export async function deleteAndReclaim(
	userId: string,
	root: CascadeRoot,
	deleteRows: () => Promise<unknown>
): Promise<void> {
	const candidates = await descendantFilePathnames(userId, root);
	await deleteRows();
	await reclaimBlobs(candidates);
}
