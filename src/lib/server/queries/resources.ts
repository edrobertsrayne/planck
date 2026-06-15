import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { resourceLink, resourceFile } from '$lib/server/db/schema';
import { ownerColumns, type OwnerRef } from '$lib/resources/owner';
import { applyOrder } from '$lib/resources/files';
import { deleteBlob, headBlob } from '$lib/server/blob';

// --- owner where-clause helpers (branch on which discriminator is set) ---
function linkOwnerEq(owner: OwnerRef) {
	if ('lessonId' in owner) return eq(resourceLink.lessonId, owner.lessonId);
	if ('scheduledLessonId' in owner)
		return eq(resourceLink.scheduledLessonId, owner.scheduledLessonId);
	if ('courseId' in owner) return eq(resourceLink.courseId, owner.courseId);
	return eq(resourceLink.moduleId, owner.moduleId);
}
function fileOwnerEq(owner: OwnerRef) {
	if ('lessonId' in owner) return eq(resourceFile.lessonId, owner.lessonId);
	if ('scheduledLessonId' in owner)
		return eq(resourceFile.scheduledLessonId, owner.scheduledLessonId);
	if ('courseId' in owner) return eq(resourceFile.courseId, owner.courseId);
	return eq(resourceFile.moduleId, owner.moduleId);
}

// --- links ---
export function listLinks(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(resourceLink)
		.where(and(eq(resourceLink.userId, userId), linkOwnerEq(owner)))
		.orderBy(resourceLink.orderIndex);
}

export async function addLink(userId: string, owner: OwnerRef, url: string, label: string | null) {
	const cols = ownerColumns(owner);
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${resourceLink.orderIndex}) + 1, 0)` })
		.from(resourceLink)
		.where(and(eq(resourceLink.userId, userId), linkOwnerEq(owner)));
	return db.insert(resourceLink).values({
		userId,
		...cols,
		url,
		label: label && label.length > 0 ? label : null,
		orderIndex: next
	});
}

export function deleteLink(userId: string, id: number) {
	return db
		.delete(resourceLink)
		.where(and(eq(resourceLink.userId, userId), eq(resourceLink.id, id)));
}

export async function reorderLinks(userId: string, orderedIds: number[]) {
	const updates = applyOrder(orderedIds).map((o) =>
		db
			.update(resourceLink)
			.set({ orderIndex: o.orderIndex })
			.where(and(eq(resourceLink.userId, userId), eq(resourceLink.id, o.id)))
	);
	if (updates.length > 0) {
		await db.batch(updates as [(typeof updates)[number], ...(typeof updates)[number][]]);
	}
}

// --- files ---
export function listFiles(userId: string, owner: OwnerRef) {
	return db
		.select()
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), fileOwnerEq(owner)))
		.orderBy(resourceFile.orderIndex);
}

export async function addFile(
	userId: string,
	owner: OwnerRef,
	file: { blobUrl: string; pathname: string; filename: string; contentType: string; size: number }
) {
	const cols = ownerColumns(owner);
	// Confirm the blob actually exists before recording it (the client reported it).
	await headBlob(file.blobUrl);
	const [{ next }] = await db
		.select({ next: sql<number>`coalesce(max(${resourceFile.orderIndex}) + 1, 0)` })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), fileOwnerEq(owner)));
	return db.insert(resourceFile).values({ userId, ...cols, ...file, orderIndex: next });
}

/** Delete a file row and its blob. Looks up pathname first (scoped to user). */
export async function deleteFile(userId: string, id: number): Promise<void> {
	const [row] = await db
		.select({ pathname: resourceFile.pathname })
		.from(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	if (!row) return;
	await db
		.delete(resourceFile)
		.where(and(eq(resourceFile.userId, userId), eq(resourceFile.id, id)));
	await deleteBlob(row.pathname);
}
