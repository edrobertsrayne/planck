import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { lesson, scheduledLesson, lessonLink, lessonFile } from '$lib/server/db/schema';
import { ownerColumns, type OwnerRef } from '$lib/lesson-content/owner';
import { applyOrder } from '$lib/lesson-content/files';
import { deleteBlob, headBlob } from '$lib/server/blob';

// --- owner where-clause helpers (branch on which side of the discriminator) ---
function linkOwnerEq(owner: OwnerRef) {
	return 'lessonId' in owner
		? eq(lessonLink.lessonId, owner.lessonId)
		: eq(lessonLink.scheduledLessonId, owner.scheduledLessonId);
}
function fileOwnerEq(owner: OwnerRef) {
	return 'lessonId' in owner
		? eq(lessonFile.lessonId, owner.lessonId)
		: eq(lessonFile.scheduledLessonId, owner.scheduledLessonId);
}

// --- plan ---
export function saveLessonPlan(userId: string, owner: OwnerRef, plan: string) {
	return 'lessonId' in owner
		? db
				.update(lesson)
				.set({ plan })
				.where(and(eq(lesson.userId, userId), eq(lesson.id, owner.lessonId)))
		: db
				.update(scheduledLesson)
				.set({ plan })
				.where(and(eq(scheduledLesson.userId, userId), eq(scheduledLesson.id, owner.scheduledLessonId)));
}

// --- links ---
export function listLinks(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(lessonLink)
		.where(and(eq(lessonLink.userId, userId), linkOwnerEq(owner)))
		.orderBy(lessonLink.orderIndex);
}

export async function addLink(userId: string, owner: OwnerRef, url: string, label: string | null) {
	const cols = ownerColumns(owner);
	const existing = await listLinks(userId, owner);
	return db.insert(lessonLink).values({
		userId,
		...cols,
		url,
		label: label && label.length > 0 ? label : null,
		orderIndex: existing.length
	});
}

export function deleteLink(userId: string, id: number) {
	return db.delete(lessonLink).where(and(eq(lessonLink.userId, userId), eq(lessonLink.id, id)));
}

export async function reorderLinks(userId: string, orderedIds: number[]) {
	const updates = applyOrder(orderedIds).map((o) =>
		db
			.update(lessonLink)
			.set({ orderIndex: o.orderIndex })
			.where(and(eq(lessonLink.userId, userId), eq(lessonLink.id, o.id)))
	);
	if (updates.length > 0) {
		await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
	}
}

// --- files ---
export function listFiles(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), fileOwnerEq(owner)))
		.orderBy(lessonFile.orderIndex);
}

export async function addFile(
	userId: string,
	owner: OwnerRef,
	file: { blobUrl: string; pathname: string; filename: string; contentType: string; size: number }
) {
	const cols = ownerColumns(owner);
	// Confirm the blob actually exists before recording it (the client reported it).
	await headBlob(file.blobUrl);
	const existing = await listFiles(userId, owner);
	return db.insert(lessonFile).values({ userId, ...cols, ...file, orderIndex: existing.length });
}

/** Delete a file row and its blob. Looks up pathname first (scoped to user). */
export async function deleteFile(userId: string, id: number): Promise<void> {
	const [row] = await db
		.select({ pathname: lessonFile.pathname })
		.from(lessonFile)
		.where(and(eq(lessonFile.userId, userId), eq(lessonFile.id, id)));
	if (!row) return;
	await deleteBlob(row.pathname);
	await db.delete(lessonFile).where(and(eq(lessonFile.userId, userId), eq(lessonFile.id, id)));
}
